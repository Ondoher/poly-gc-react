// References:
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, null incident-radiance variant.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M0 scaffold and M1 abstraction closure.

/** @type {IncidentRadianceCacheDescriptor} */
const cacheDescriptor = Object.freeze({
    cacheKind: 'none',
    sourceKey: 'none',
    version: 1,
    dimensions: Object.freeze([]),
});

/** @type {IncidentRadianceSampler} */
const incidentRadianceSampler = () => Object.freeze([]);

/** @type {IncidentRadianceSampling} */
const noIncidentRadiance = Object.freeze({
    cacheDescriptor,
    incidentRadianceSampler,
});

export default noIncidentRadiance;
