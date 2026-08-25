// Experimental snapshot references:
// - src/flat32/index.js, LOCATION_PRESETS, FLAT_TIME_PRESETS, and GLOBE_TIME_PRESETS.
// - agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md.
//
// This POC owns a bounded snapshot for reconciliation evidence. It does not
// runtime-link to flat32 or production code.

export const FLAT32_SUBJECTIVE_LOCATION_PRESETS = Object.freeze([
    Object.freeze({
        key: 'san-jose',
        label: 'San Jose',
        name: 'San Jose, CA',
        latitude: 37.3382,
        longitude: -121.8863,
        dateBasis: '2024-06-20T12:00:00.000Z',
    }),
    Object.freeze({
        key: 'union-glacier',
        label: 'Union Glacier',
        name: 'Union Glacier Camp',
        latitude: -79.768036,
        longitude: -83.261666,
        dateBasis: '2024-12-14T12:00:00.000Z',
    }),
]);

export const FLAT32_SUBJECTIVE_FLAT_TIME_PRESETS = Object.freeze([
    Object.freeze({ key: 'flat-0', label: 'Flat 0', offsetDegrees: 0 }),
    Object.freeze({ key: 'flat-45', label: 'Flat 45', offsetDegrees: 45 }),
    Object.freeze({ key: 'flat-90', label: 'Flat 90', offsetDegrees: 90 }),
    Object.freeze({ key: 'flat-135', label: 'Flat 135', offsetDegrees: 135 }),
    Object.freeze({ key: 'flat-180', label: 'Flat 180', offsetDegrees: 180 }),
]);

export const FLAT32_SUBJECTIVE_GLOBE_TIME_PRESETS = Object.freeze([
    Object.freeze({ key: 'globe-sunrise', label: 'Sunrise', kind: 'sunrise' }),
    Object.freeze({
        key: 'globe-solar-noon',
        label: 'Solar Noon',
        kind: 'solar-noon-offset',
        offsetHours: 0,
    }),
    Object.freeze({ key: 'globe-sunset', label: 'Sun Set', kind: 'sunset' }),
]);

export const FLAT32_SUBJECTIVE_TIME_SNAPSHOT = Object.freeze({
    id: 'flat32-subjective-scene-time-snapshot-v1',
    ownership: 'reconciliation-poc-experimental-snapshot',
    runtimeLinkPolicy: 'poc-local-no-external-runtime-links',
    sourceRevision: '514d5f6080d2dd485efdb07b5da9a203357a40c0',
    sourceDescription: 'Manually adapted from the flat32 location/time calibration state on 2026-07-11.',
});
