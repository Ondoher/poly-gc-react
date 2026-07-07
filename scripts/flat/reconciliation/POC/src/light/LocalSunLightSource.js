// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.2 local light source.
// - agents/topics/apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md, local-013, local-017, local-019, local-020.
// - tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward.

import LocalSunIncidentRadianceCache from '../incident-radiance/LocalSunIncidentRadianceCache.js';
import { normalize } from '../math/vector.js';

export default class LocalSunLightSource {
    /**
     * @param {LocalSunLightSourceConfig} configuration - Local finite-source configuration.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('LocalSunLightSource configuration is required.');
        }

        const {
            sourceKey,
            spectralChannels,
            referenceDistanceMeters,
            referenceSpectralIncidentScale,
            radiusMeters,
            distanceFalloff = true,
            cacheZBinsMeters = [0],
            cacheRhoBinsMeters = [0],
            cacheDirectionCount = 1,
        } = configuration;

        if (!sourceKey || !Array.isArray(spectralChannels) || spectralChannels.length < 1) {
            throw new TypeError('LocalSunLightSource requires sourceKey and spectralChannels.');
        }

        if (![referenceDistanceMeters, referenceSpectralIncidentScale, radiusMeters].every(Number.isFinite)) {
            throw new TypeError('LocalSunLightSource distance, scale, and radius must be finite.');
        }

        this._configuration = Object.freeze({
            sourceKey,
            spectralChannels: Object.freeze([...spectralChannels]),
            referenceDistanceMeters,
            referenceSpectralIncidentScale,
            radiusMeters,
            distanceFalloff,
            cacheZBinsMeters: Object.freeze([...cacheZBinsMeters]),
            cacheRhoBinsMeters: Object.freeze([...cacheRhoBinsMeters]),
            cacheDirectionCount,
        });
    }

    get configuration() {
        return this._configuration;
    }

    /**
     * @returns {IncidentRadianceCacheDescriptor} Local incident-radiance cache descriptor.
     */
    describeIncidentRadianceCache() {
        return Object.freeze({
            cacheKind: 'local',
            sourceKey: this._configuration.sourceKey,
            version: 1,
            dimensions: Object.freeze(['z', 'rho', 'incomingDirection', 'wavelength']),
            metadata: Object.freeze({
                zBinCount: this._configuration.cacheZBinsMeters.length,
                rhoBinCount: this._configuration.cacheRhoBinsMeters.length,
                directionCount: this._configuration.cacheDirectionCount,
                lookupPolicy: 'nearest-neighbor-poc-grid',
            }),
        });
    }

    /**
     * @param {{ readonly spectralBasis?: SpectralBasis }} [request] - Cache creation request.
     * @returns {IncidentRadianceCache} Local incident-radiance cache.
     */
    createIncidentRadianceCache(request = {}) {
        const spectralBasis = request.spectralBasis ?? Object.freeze({
            wavelengthsNanometers: Object.freeze(
                this._configuration.spectralChannels.map((channel) => channel.wavelengthNanometers),
            ),
        });

        return new LocalSunIncidentRadianceCache({
            descriptor: this.describeIncidentRadianceCache(),
            zBinsMeters: this._configuration.cacheZBinsMeters,
            rhoBinsMeters: this._configuration.cacheRhoBinsMeters,
            directionCount: this._configuration.cacheDirectionCount,
            spectralBasis,
        });
    }

    /**
     * @param {{
     *   readonly sourceRelativePosition?: SourceRelativePosition,
     *   readonly spectralBasis?: SpectralBasis
     * }} request - Direct lighting request.
     * @returns {DirectLightingSample} Local direct-light sample.
     */
    sampleDirectLighting(request = {}) {
        const sourceRelativePosition = request.sourceRelativePosition;

        if (!sourceRelativePosition) {
            throw new TypeError('LocalSunLightSource.sampleDirectLighting requires sourceRelativePosition.');
        }

        const distanceFromSourceMeters = sourceRelativePosition.distanceFromSourceMeters;
        const directionToLight = normalize(sourceRelativePosition.directionToSource ?? [0, 0, 1]);
        const safeDistanceMeters = Math.max(
            this._configuration.radiusMeters,
            Number.isFinite(distanceFromSourceMeters) ? distanceFromSourceMeters : this._configuration.referenceDistanceMeters,
        );
        const falloffScale = this._configuration.distanceFalloff
            ? (this._configuration.referenceDistanceMeters / safeDistanceMeters) ** 2
            : 1;
        const incidentScale = this._configuration.referenceSpectralIncidentScale * falloffScale;
        const incidentRadiance = this._configuration.spectralChannels.map((channel) =>
            channel.solarIrradiance * incidentScale);

        return Object.freeze({
            incidentRadiance: Object.freeze(incidentRadiance),
            directionToLight,
            metadata: Object.freeze({
                sourceKey: this._configuration.sourceKey,
                distanceFromSourceMeters,
                safeDistanceMeters,
                radiusMeters: this._configuration.radiusMeters,
                referenceDistanceMeters: this._configuration.referenceDistanceMeters,
                referenceSpectralIncidentScale: this._configuration.referenceSpectralIncidentScale,
                falloffScale,
                incidentScale,
                distanceClampedToRadius: safeDistanceMeters !== distanceFromSourceMeters,
                spectralScaleKind: 'neutral-no-tint',
            }),
        });
    }

    /**
     * @param {LightSourceThreeLightingRequest} request - Three scene-light conversion request.
     * @returns {LightSourceThreeLightingObjects} Source-owned Three lighting objects.
     */
    createThreeLightingObjects(request = {}) {
        const THREE = request.THREE;

        if (
            !THREE
            || typeof THREE.AmbientLight !== 'function'
            || typeof THREE.PointLight !== 'function'
            || typeof THREE.DirectionalLight !== 'function'
            || typeof THREE.Object3D !== 'function'
        ) {
            throw new TypeError('LocalSunLightSource.createThreeLightingObjects requires THREE lighting constructors.');
        }

        const sourcePositionSceneUnits = vector3Tuple(
            request.sourcePositionSceneUnits,
            'sourcePositionSceneUnits',
        );
        const observerScenePositionUnits = request.observerScenePositionUnits
            ? vector3Tuple(request.observerScenePositionUnits, 'observerScenePositionUnits')
            : Object.freeze([0, 0, 0]);
        const directLighting = this.sampleDirectLighting({
            sourceRelativePosition: request.sourceRelativePosition,
        });
        const metadata = directLighting.metadata && typeof directLighting.metadata === 'object'
            ? directLighting.metadata
            : {};
        const observerIncidentScale = finiteNumberOrDefault(metadata.incidentScale, 1);
        const calibrationScalar = finiteNumberOrDefault(request.calibrationScalar, 2.4);
        const baseAmbientIntensity = finiteNumberOrDefault(request.ambientIntensity, 1.00);
        const endpointSceneLightScalePolicy = endpointSceneLightScalePolicyOrDefault(
            request.endpointSceneLightScalePolicy,
        );
        const endpointSceneIncidentScale = endpointSceneLightScalePolicy === 'observer-incident-scale'
            ? observerIncidentScale
            : 1;
        const pointLightIntensity = calibrationScalar * endpointSceneIncidentScale;
        const endpointIndirectFill = endpointIndirectFillRequestOrNull(request.endpointIndirectFill);
        const endpointIndirectFillIntensity = endpointIndirectFill
            ? pointLightIntensity * endpointIndirectFill.intensityRatio
            : 0;
        const observerScaledAmbientIntensity = baseAmbientIntensity * Math.max(observerIncidentScale, 0);
        const ambientIntensity = observerScaledAmbientIntensity
            + (endpointIndirectFill?.policy === 'general-ambient-fill' ? endpointIndirectFillIntensity : 0);
        const ambient = new THREE.AmbientLight(0xffffff, ambientIntensity);
        const directionToSourceScene = directionBetweenScenePoints(
            observerScenePositionUnits,
            sourcePositionSceneUnits,
        );
        const shadow = shadowRequestOrNull(request.shadow);
        const sceneObjects = [];
        const sourceDrivenLight = shadow
            ? createShadowDirectionalLight({
                THREE,
                sourceKey: this._configuration.sourceKey,
                intensity: pointLightIntensity,
                directionToSourceScene,
                shadow,
                sceneObjects,
            })
            : createSourcePointLight({
                THREE,
                sourceKey: this._configuration.sourceKey,
                intensity: pointLightIntensity,
                sourcePositionSceneUnits,
                observerIncidentScale,
                endpointSceneIncidentScale,
                calibrationScalar,
                endpointSceneLightScalePolicy,
            });
        const endpointDirectionalFillLight = endpointIndirectFill?.policy === 'opposite-directional-fill'
            ? createOppositeDirectionalFillLight({
                THREE,
                sourceKey: this._configuration.sourceKey,
                intensity: endpointIndirectFillIntensity,
                directionToSourceScene,
                focusSceneUnits: observerScenePositionUnits,
                distanceSceneUnits: endpointIndirectFill.distanceSceneUnits,
                sceneObjects,
            })
            : null;
        const endpointSourceFalloffFillLight = endpointIndirectFill?.policy === 'source-direction-falloff-fill'
            ? createSourceDirectionFalloffFillLight({
                THREE,
                sourceKey: this._configuration.sourceKey,
                targetIntensity: endpointIndirectFillIntensity,
                directionToSourceScene,
                focusSceneUnits: observerScenePositionUnits,
                distanceSceneUnits: endpointIndirectFill.distanceSceneUnits,
                sceneObjects,
            })
            : null;

        ambient.name = `${this._configuration.sourceKey}-ambient-fill`;
        ambient.userData.algorithm32SourceLight = true;
        ambient.userData.sourceKey = this._configuration.sourceKey;
        ambient.userData.lightingRole = 'ambient-fill';

        return Object.freeze({
            lights: Object.freeze([
                ambient,
                sourceDrivenLight,
                ...(endpointDirectionalFillLight ? [endpointDirectionalFillLight] : []),
                ...(endpointSourceFalloffFillLight ? [endpointSourceFalloffFillLight] : []),
            ]),
            sceneObjects: Object.freeze(sceneObjects),
            metadata: Object.freeze({
                owner: 'LocalSunLightSource',
                lightingPolicy: shadow
                    ? 'source-driven-flat-local-directional-shadow-light'
                    : 'source-driven-flat-local-point-light',
                endpointColorStatus:
                    request.endpointColorStatus ?? 'three-lambert-shading-captured-from-effect-composer-render-pass',
                baseAmbientIntensity,
                observerScaledAmbientIntensity,
                ambientIntensity,
                pointLightIntensity,
                endpointIndirectFill: endpointIndirectFill
                    ? Object.freeze({
                        ...endpointIndirectFill,
                        intensity: endpointIndirectFillIntensity,
                        role: endpointIndirectFillRole(endpointIndirectFill.policy),
                        directionToFillScene: endpointIndirectFillDirection(endpointIndirectFill.policy, directionToSourceScene),
                    })
                    : Object.freeze({
                        enabled: false,
                        policy: 'none',
                    }),
                calibrationScalar,
                observerIncidentScale,
                endpointSceneIncidentScale,
                endpointSceneLightScalePolicy,
                falloffScale: metadata.falloffScale,
                distanceFromSourceMeters: metadata.distanceFromSourceMeters,
                safeDistanceMeters: metadata.safeDistanceMeters,
                referenceDistanceMeters: metadata.referenceDistanceMeters,
                referenceSpectralIncidentScale: metadata.referenceSpectralIncidentScale,
                distanceAttenuationPolicy:
                    shadow
                        ? distanceAttenuationPolicyForDirectionalShadow(endpointSceneLightScalePolicy)
                        : distanceAttenuationPolicyForPointLight(endpointSceneLightScalePolicy),
                shadowPolicy: shadow ? 'three-shadow-map-from-local-source-direction' : 'shadows-disabled',
                shadow: shadow ? Object.freeze({ ...shadow }) : null,
                directionToSourceScene,
                directionToSourceModel: directLighting.directionToLight,
                sourcePositionSceneUnits,
                observerScenePositionUnits,
                sourceKey: this._configuration.sourceKey,
            }),
        });
    }

    /**
     * @param {{ readonly sourceRelativePosition?: SourceRelativePosition }} request - Source-path request.
     * @returns {SourcePathLimit} Finite source path limit.
     */
    resolveSourcePathLimit(request = {}) {
        const distance = request.sourceRelativePosition?.distanceFromSourceMeters;

        return Object.freeze({
            maxDistanceMeters: Number.isFinite(distance) ? Math.max(0, distance) : null,
            reason: 'finite-local-source-distance',
        });
    }
}

function finiteNumberOrDefault(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function endpointSceneLightScalePolicyOrDefault(value) {
    return value === 'observer-incident-scale'
        ? 'observer-incident-scale'
        : 'endpoint-material-shading';
}

function distanceAttenuationPolicyForDirectionalShadow(endpointSceneLightScalePolicy) {
    return endpointSceneLightScalePolicy === 'observer-incident-scale'
        ? 'Directional shadow light uses the local source direction and observer incident scale for endpoint scene shading/shadows; Algorithm32 transport also applies finite source scale.'
        : 'Directional shadow light uses the local source direction for endpoint material shading/shadows; Algorithm32 transport applies finite source scale.';
}

function distanceAttenuationPolicyForPointLight(endpointSceneLightScalePolicy) {
    return endpointSceneLightScalePolicy === 'observer-incident-scale'
        ? 'PointLight uses decay=0 and observer incident scale for endpoint scene shading; Algorithm32 transport also applies finite source scale.'
        : 'PointLight uses decay=0 and transport-neutral endpoint material shading intensity; Algorithm32 transport applies finite source scale.';
}

function createSourcePointLight({
    THREE,
    sourceKey,
    intensity,
    sourcePositionSceneUnits,
    observerIncidentScale,
    endpointSceneIncidentScale,
    calibrationScalar,
    endpointSceneLightScalePolicy,
}) {
    const pointLight = new THREE.PointLight(0xffffff, intensity, 0, 0);

    pointLight.name = `${sourceKey}-source-driven-point-light`;
    pointLight.position.set(...sourcePositionSceneUnits);
    pointLight.userData.algorithm32SourceLight = true;
    pointLight.userData.sourceKey = sourceKey;
    pointLight.userData.observerIncidentScale = observerIncidentScale;
    pointLight.userData.endpointSceneIncidentScale = endpointSceneIncidentScale;
    pointLight.userData.endpointSceneLightScalePolicy = endpointSceneLightScalePolicy;
    pointLight.userData.calibrationScalar = calibrationScalar;
    pointLight.userData.distanceAttenuationPolicy =
        distanceAttenuationPolicyForPointLight(endpointSceneLightScalePolicy);

    return pointLight;
}

function createShadowDirectionalLight({
    THREE,
    sourceKey,
    intensity,
    directionToSourceScene,
    shadow,
    sceneObjects,
}) {
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    const target = new THREE.Object3D();
    const focus = shadow.focusSceneUnits;
    const distance = shadow.lightDistanceSceneUnits;
    const extent = shadow.extentSceneUnits;

    light.name = `${sourceKey}-source-driven-shadow-directional-light`;
    light.position.set(
        focus[0] + directionToSourceScene[0] * distance,
        focus[1] + directionToSourceScene[1] * distance,
        focus[2] + directionToSourceScene[2] * distance,
    );
    target.name = `${sourceKey}-source-driven-shadow-target`;
    target.position.set(...focus);
    light.target = target;
    light.castShadow = true;
    light.shadow.mapSize.width = shadow.mapSize;
    light.shadow.mapSize.height = shadow.mapSize;
    light.shadow.camera.left = -extent;
    light.shadow.camera.right = extent;
    light.shadow.camera.top = extent;
    light.shadow.camera.bottom = -extent;
    light.shadow.camera.near = shadow.cameraNear;
    light.shadow.camera.far = shadow.cameraFar;
    light.shadow.bias = shadow.bias;
    light.shadow.normalBias = shadow.normalBias;
    light.userData.algorithm32SourceLight = true;
    light.userData.sourceKey = sourceKey;
    light.userData.shadowPolicy = 'three-shadow-map-from-local-source-direction';
    target.userData.algorithm32SourceLight = true;
    target.userData.sourceKey = sourceKey;
    target.userData.shadowPolicy = 'three-shadow-map-target';
    sceneObjects.push(target);

    return light;
}

function createOppositeDirectionalFillLight({
    THREE,
    sourceKey,
    intensity,
    directionToSourceScene,
    focusSceneUnits,
    distanceSceneUnits,
    sceneObjects,
}) {
    const fillDirection = oppositeDirectionalFillDirection(directionToSourceScene);
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    const target = new THREE.Object3D();

    light.name = `${sourceKey}-opposite-directional-endpoint-fill`;
    light.position.set(
        focusSceneUnits[0] + fillDirection[0] * distanceSceneUnits,
        focusSceneUnits[1] + fillDirection[1] * distanceSceneUnits,
        focusSceneUnits[2] + fillDirection[2] * distanceSceneUnits,
    );
    target.name = `${sourceKey}-opposite-directional-endpoint-fill-target`;
    target.position.set(...focusSceneUnits);
    light.target = target;
    light.castShadow = false;
    light.userData.algorithm32SourceLight = true;
    light.userData.sourceKey = sourceKey;
    light.userData.lightingRole = 'opposite-directional-endpoint-fill';
    light.userData.endpointColorStatus = 'vacuum-endpoint-directional-fill-approximation';
    target.userData.algorithm32SourceLight = true;
    target.userData.sourceKey = sourceKey;
    target.userData.lightingRole = 'opposite-directional-endpoint-fill-target';
    sceneObjects.push(target);

    return light;
}

function createSourceDirectionFalloffFillLight({
    THREE,
    sourceKey,
    targetIntensity,
    directionToSourceScene,
    focusSceneUnits,
    distanceSceneUnits,
    sceneObjects,
}) {
    const fillDirection = normalize([
        directionToSourceScene[0],
        Math.abs(directionToSourceScene[1]),
        directionToSourceScene[2],
    ]);
    const lightDistanceSceneUnits = Math.max(1, distanceSceneUnits);
    const calibratedIntensity = targetIntensity * lightDistanceSceneUnits * lightDistanceSceneUnits;
    const light = new THREE.PointLight(0xffffff, calibratedIntensity, 0, 2);
    const marker = new THREE.Object3D();

    light.name = `${sourceKey}-source-direction-falloff-endpoint-fill`;
    light.position.set(
        focusSceneUnits[0] + fillDirection[0] * lightDistanceSceneUnits,
        focusSceneUnits[1] + fillDirection[1] * lightDistanceSceneUnits,
        focusSceneUnits[2] + fillDirection[2] * lightDistanceSceneUnits,
    );
    light.castShadow = false;
    light.userData.algorithm32SourceLight = true;
    light.userData.sourceKey = sourceKey;
    light.userData.lightingRole = 'source-direction-falloff-endpoint-fill';
    light.userData.endpointColorStatus = 'vacuum-endpoint-source-direction-falloff-fill-approximation';
    light.userData.targetIntensityAtFocus = targetIntensity;
    light.userData.distanceSceneUnits = lightDistanceSceneUnits;
    light.userData.decay = 2;
    marker.name = `${sourceKey}-source-direction-falloff-endpoint-fill-anchor`;
    marker.position.set(...focusSceneUnits);
    marker.userData.algorithm32SourceLight = true;
    marker.userData.sourceKey = sourceKey;
    marker.userData.lightingRole = 'source-direction-falloff-endpoint-fill-anchor';
    sceneObjects.push(marker);

    return light;
}

function shadowRequestOrNull(shadow) {
    if (!shadow || shadow.enabled !== true) {
        return null;
    }

    const focusSceneUnits = vector3Tuple(shadow.focusSceneUnits ?? [0, 0, 0], 'shadow.focusSceneUnits');
    const extentSceneUnits = Math.max(0.001, finiteNumberOrDefault(shadow.extentSceneUnits, 20));
    const lightDistanceSceneUnits = Math.max(
        extentSceneUnits * 2,
        finiteNumberOrDefault(shadow.lightDistanceSceneUnits, extentSceneUnits * 4),
    );
    const cameraNear = Math.max(0.001, finiteNumberOrDefault(shadow.cameraNear, 0.1));
    const cameraFar = Math.max(
        cameraNear + 0.001,
        finiteNumberOrDefault(shadow.cameraFar, lightDistanceSceneUnits + extentSceneUnits * 4),
    );
    const mapSize = Math.max(16, Math.floor(finiteNumberOrDefault(shadow.mapSize, 2048)));

    return Object.freeze({
        enabled: true,
        focusSceneUnits,
        extentSceneUnits,
        lightDistanceSceneUnits,
        cameraNear,
        cameraFar,
        mapSize,
        bias: finiteNumberOrDefault(shadow.bias, -0.00002),
        normalBias: finiteNumberOrDefault(shadow.normalBias, 0.02),
    });
}

function endpointIndirectFillRequestOrNull(endpointIndirectFill) {
    if (!endpointIndirectFill || endpointIndirectFill.enabled !== true) {
        return null;
    }

    const intensityRatio = Math.max(
        0,
        finiteNumberOrDefault(endpointIndirectFill.intensityRatio, 0.25),
    );

    return Object.freeze({
        enabled: true,
        policy: endpointIndirectFillPolicyOrDefault(endpointIndirectFill.policy),
        intensityRatio,
        distanceSceneUnits: Math.max(
            1,
            finiteNumberOrDefault(endpointIndirectFill.distanceSceneUnits, 100),
        ),
    });
}

function endpointIndirectFillPolicyOrDefault(policy) {
    if (policy === 'opposite-directional-fill') {
        return 'opposite-directional-fill';
    }
    if (policy === 'source-direction-falloff-fill') {
        return 'source-direction-falloff-fill';
    }
    return 'general-ambient-fill';
}

function endpointIndirectFillRole(policy) {
    if (policy === 'opposite-directional-fill') {
        return 'vacuum-endpoint-opposite-directional-approximation';
    }
    if (policy === 'source-direction-falloff-fill') {
        return 'vacuum-endpoint-source-direction-falloff-approximation';
    }
    return 'vacuum-endpoint-general-ambient-approximation';
}

function endpointIndirectFillDirection(policy, directionToSourceScene) {
    if (policy === 'opposite-directional-fill') {
        return oppositeDirectionalFillDirection(directionToSourceScene);
    }
    if (policy === 'source-direction-falloff-fill') {
        return normalize([
            directionToSourceScene[0],
            Math.abs(directionToSourceScene[1]),
            directionToSourceScene[2],
        ]);
    }
    return null;
}

function oppositeDirectionalFillDirection(directionToSourceScene) {
    const horizontalOpposite = [
        -directionToSourceScene[0],
        Math.abs(directionToSourceScene[1]),
        -directionToSourceScene[2],
    ];

    return normalize(horizontalOpposite);
}

function vector3Tuple(value, label) {
    if (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) {
        return Object.freeze([value[0], value[1], value[2]]);
    }

    throw new TypeError(`LocalSunLightSource.createThreeLightingObjects requires finite ${label}.`);
}

function directionBetweenScenePoints(from, to) {
    const delta = [
        to[0] - from[0],
        to[1] - from[1],
        to[2] - from[2],
    ];

    return normalize(delta);
}
