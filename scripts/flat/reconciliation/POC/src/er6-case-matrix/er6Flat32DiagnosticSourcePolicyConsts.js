// Bounded diagnostic-only copies from:
// - src/flat32/index.js @ 514d5f6080d2dd485efdb07b5da9a203357a40c0.
// - scripts/flat/reconciliation/POC/src/subjective-scenes/flat32SceneSnapshot.js.
//
// These authored values are retained so ER6 can prove that none of them enters
// the physical frame. They are not physical source facts.

export const ER6_FLAT32_DIAGNOSTIC_SOURCE_POLICY = Object.freeze({
    kind: 'er6-flat32-diagnostic-source-policy-v1',
    sourceRevision: '514d5f6080d2dd485efdb07b5da9a203357a40c0',
    ownership: 'er6-reset-owned-bounded-diagnostic-copy',
    runtimeLinkPolicy: 'no-flat32-pre-reset-renderer-or-production-runtime-links',
    physicalPolicy: Object.freeze({
        spectralFlux: 0,
        spectralFluxUnits: 'W m^-2 nm^-1',
        frameParticipation: 'excluded',
        status: 'diagnostic-only',
    }),
    syntheticStars: Object.freeze({
        count: 192,
        magnitudeRange: Object.freeze({ min: -1.46, max: 5.09 }),
        rejectedLegacyFacts: Object.freeze({
            referenceMagnitude: -1.46,
            referenceSceneRgb: 0.004,
            radiusBaseDistanceRatio: 0.00022,
            radiusPerStylePixelDistanceRatio: 0.00016,
        }),
    }),
    calibrationLadder: Object.freeze({
        count: 8,
        rejectedLegacyLevels: Object.freeze([
            Object.freeze({ label: 'A', sceneRgb: 0.000005 }),
            Object.freeze({ label: 'B', sceneRgb: 0.000015 }),
            Object.freeze({ label: 'C', sceneRgb: 0.00005 }),
            Object.freeze({ label: 'D', sceneRgb: 0.00015 }),
            Object.freeze({ label: 'E', sceneRgb: 0.00045 }),
            Object.freeze({ label: 'F', sceneRgb: 0.00135 }),
            Object.freeze({ label: 'G', sceneRgb: 0.004 }),
            Object.freeze({ label: 'H', sceneRgb: 0.012 }),
        ]),
    }),
    exclusions: Object.freeze([
        'authored-angular-disk-as-physical-footprint',
        'scene-rgb-as-spectral-radiometry',
        'magnitude-scaled-solar-spectrum',
        'source-only-exposure',
    ]),
});
