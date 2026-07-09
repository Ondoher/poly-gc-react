/**
 * Store the setup-bound no-incident-radiance sampling packet.
 *
 * @type {IncidentRadianceSampling}
 */
const noIncidentRadiance = Object.freeze({
	cacheDescriptor: Object.freeze({
		cacheKind: 'none',
		sourceKey: 'none',
		version: 1,
		dimensions: Object.freeze([]),
	}),
	incidentRadianceSampler: () => Object.freeze([]),
});

export default noIncidentRadiance;
