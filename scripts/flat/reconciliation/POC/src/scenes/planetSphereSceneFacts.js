// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M3 planet-sphere scene parity.
// - scripts/flat/reconciliation/POC/browser-page/runner.js, browser planet scene capture.

const PLANET_SPHERE_SCENE_FACTS = Object.freeze({
    displayRgba: Object.freeze({
        sky: Object.freeze([132, 160, 190, 255]),
        ground: Object.freeze([86, 105, 66, 255]),
        greenBox: Object.freeze([0, 170, 40, 255]),
    }),
    lighting: Object.freeze({
        ambientIntensity: 1.1,
        directionalIntensity: 4.0,
    }),
    groundSphereSegments: Object.freeze({
        width: 512,
        height: 256,
    }),
    endpointRadianceScale: 5200,
    materialPolicy: 'visible-mesh-lambert-scene-color',
});

export default PLANET_SPHERE_SCENE_FACTS;
