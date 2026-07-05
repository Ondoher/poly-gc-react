// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.1.3.
// - agents/topics/apps/flat/reconciliation/shader-design.md, ThreeGateway and CPU postprocess shader.
// - scripts/flat/algorithm32-shader-lab/node-three-reference.js, Node/Three raycast bridge lineage.

import * as THREE from 'three';

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

const DEFAULT_COORDINATE_MAPPING_ID = 'three-x-y-z-to-algorithm-east-north-up';

export default class ThreeSceneSoftShaderBridge {
    /**
     * @param {ThreeSceneSoftShaderBridgeConfig} configuration - Three scene and camera facts.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new ReconciliationConfigurationError('Three scene bridge configuration is required.', {
                code: 'MISSING_THREE_SCENE_BRIDGE_CONFIGURATION',
            });
        }

        if (!configuration.camera || typeof configuration.camera.updateMatrixWorld !== 'function') {
            throw new ReconciliationConfigurationError('Three scene bridge requires a Three camera.', {
                code: 'MISSING_THREE_SCENE_BRIDGE_CAMERA',
            });
        }

        if (!Array.isArray(configuration.meshes) || configuration.meshes.length === 0) {
            throw new ReconciliationConfigurationError('Three scene bridge requires at least one raycast mesh.', {
                code: 'MISSING_THREE_SCENE_BRIDGE_MESHES',
            });
        }

        const viewportPixels = this._normalizeViewport(configuration.viewportPixels);
        this._configuration = Object.freeze({
            sceneId: this._requireString(configuration.sceneId, 'sceneId'),
            camera: configuration.camera,
            meshes: Object.freeze([...configuration.meshes]),
            viewportPixels,
            coordinateMappingId: configuration.coordinateMappingId ?? DEFAULT_COORDINATE_MAPPING_ID,
            defaultPathIntervalCount: configuration.defaultPathIntervalCount ?? undefined,
        });
    }

    /**
     * @param {ThreeSceneSoftShaderBridgeCaptureRequest} request - Capture request.
     * @returns {ThreeSceneSoftShaderBridgeCapture} Soft-shader scene input plus selected pixels.
     */
    captureSceneInput(request) {
        if (!request || typeof request !== 'object') {
            throw new ReconciliationConfigurationError('Three scene bridge capture request is required.', {
                code: 'MISSING_THREE_SCENE_BRIDGE_CAPTURE_REQUEST',
            });
        }

        if (!Array.isArray(request.selectedPixels) || request.selectedPixels.length === 0) {
            throw new ReconciliationConfigurationError('Three scene bridge requires selected pixels to capture.', {
                code: 'MISSING_THREE_SCENE_BRIDGE_SELECTED_PIXELS',
            });
        }

        this._configuration.camera.updateMatrixWorld(true);
        this._configuration.camera.updateProjectionMatrix?.();
        for (const mesh of this._configuration.meshes) {
            mesh.updateMatrixWorld?.(true);
        }

        const pixels = request.selectedPixels.map((selection) => this._captureSelectedPixel(selection));
        const summary = summarizePixels({
            sceneId: this._configuration.sceneId,
            coordinateMappingId: this._configuration.coordinateMappingId,
            pixels,
        });

        return Object.freeze({
            sceneInput: Object.freeze({
                sceneId: this._configuration.sceneId,
                sourceKind: 'three-capture',
                sourceDescriptorId: request.sourceDescriptorId ?? 'node-three-controlled-source',
                geometryDescriptorId: request.geometryDescriptorId ?? 'node-three-controlled-geometry',
                atmosphereDescriptorId: request.atmosphereDescriptorId ?? 'node-three-controlled-atmosphere',
                lightSourceDescriptorId: request.lightSourceDescriptorId ?? 'node-three-controlled-light-source',
                cacheDescriptorId: request.cacheDescriptorId ?? null,
                displayDescriptorId: request.displayDescriptorId ?? 'bruneton-color-display',
                viewportPixels: this._configuration.viewportPixels,
                metadata: Object.freeze({
                    ...(isPlainObject(request.metadata) ? request.metadata : {}),
                    coordinateMappingId: this._configuration.coordinateMappingId,
                }),
            }),
            pixels: Object.freeze(pixels),
            diagnostics: Object.freeze([]),
            summary,
        });
    }

    /**
     * @param {ThreeSceneBridgePixelSelection} selection - Pixel selection to raycast.
     * @returns {SoftShaderScenePixelInput} Captured soft-shader pixel.
     */
    _captureSelectedPixel(selection) {
        const pixelId = this._requireString(selection.pixelId, 'selectedPixel.pixelId');
        const x = this._requireInteger(selection.x, 'selectedPixel.x');
        const y = this._requireInteger(selection.y, 'selectedPixel.y');
        const [width, height] = this._configuration.viewportPixels;

        if (x < 0 || x >= width || y < 0 || y >= height) {
            throw new ReconciliationConfigurationError('Selected pixel is outside the bridge viewport.', {
                code: 'THREE_SCENE_SELECTED_PIXEL_OUT_OF_RANGE',
                details: { pixelId, x, y, width, height },
            });
        }

        const ndc = pixelToNdc(x, y, width, height);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(ndc, this._configuration.camera);
        const hits = raycaster.intersectObjects(this._configuration.meshes, false);
        const hit = hits.length > 0 ? hits[0] : null;
        const ray = Object.freeze({
            origin: mapThreePointToAlgorithm(raycaster.ray.origin),
            direction: normalize(mapThreeDirectionToAlgorithm(raycaster.ray.direction)),
        });

        return Object.freeze({
            pixelId,
            coordinate: Object.freeze({ x, y }),
            ray,
            sceneIntersection: hit
                ? this._hitIntersection(hit)
                : Object.freeze({ kind: 'no-hit' }),
            endpointContribution: hit
                ? this._hitEndpointContribution(hit)
                : null,
            pathIntervalCount: this._configuration.defaultPathIntervalCount,
            metadata: Object.freeze({
                source: 'node-three-raycaster',
                ndc: Object.freeze([ndc.x, ndc.y]),
                threeRay: Object.freeze({
                    origin: freezeVector3(raycaster.ray.origin),
                    direction: freezeVector3(raycaster.ray.direction),
                }),
                hitObjectId: hit?.object?.name || null,
                hitDistanceMeters: hit?.distance ?? null,
                coordinateMappingId: this._configuration.coordinateMappingId,
            }),
        });
    }

    /**
     * @param {THREE.Intersection} hit - Three intersection.
     * @returns {SoftShaderSceneIntersection} Soft-shader scene hit.
     */
    _hitIntersection(hit) {
        return Object.freeze({
            kind: 'hit',
            distanceMeters: hit.distance,
            hitPosition: mapThreePointToAlgorithm(hit.point),
            metadata: Object.freeze({
                hitObjectId: hit.object?.name || null,
            }),
        });
    }

    /**
     * @param {THREE.Intersection} hit - Three intersection.
     * @returns {SoftShaderEndpointContribution} Endpoint contribution packet.
     */
    _hitEndpointContribution(hit) {
        const spectralReferenceId = hit.object?.userData?.spectralReferenceId
            ?? hit.object?.userData?.spectrumId
            ?? 'fixture-neutral-medium';

        return Object.freeze({
            policy: 'spectrum-id-reference-radiance',
            opacity: 'opaque',
            spectralReferenceId,
            metadata: Object.freeze({
                hitObjectId: hit.object?.name || null,
            }),
        });
    }

    /**
     * @param {unknown} viewportPixels - Candidate viewport tuple.
     * @returns {readonly [number, number]} Normalized viewport.
     */
    _normalizeViewport(viewportPixels) {
        if (
            !Array.isArray(viewportPixels)
            || viewportPixels.length !== 2
            || !viewportPixels.every(Number.isInteger)
            || viewportPixels.some((value) => value <= 0)
        ) {
            throw new ReconciliationConfigurationError('Viewport must be a positive integer [width, height] tuple.', {
                code: 'INVALID_THREE_SCENE_BRIDGE_VIEWPORT',
                details: { viewportPixels },
            });
        }

        return Object.freeze([viewportPixels[0], viewportPixels[1]]);
    }

    /**
     * @param {unknown} value - Candidate integer.
     * @param {string} fieldName - Field name.
     * @returns {number} Integer value.
     */
    _requireInteger(value, fieldName) {
        if (!Number.isInteger(value)) {
            throw new ReconciliationConfigurationError(`${fieldName} must be an integer.`, {
                code: 'INVALID_INTEGER_FIELD',
                details: { fieldName, value },
            });
        }

        return value;
    }

    /**
     * @param {unknown} value - Candidate string.
     * @param {string} fieldName - Field name.
     * @returns {string} String value.
     */
    _requireString(value, fieldName) {
        if (typeof value !== 'string' || value.length === 0) {
            throw new ReconciliationConfigurationError(`${fieldName} must be a non-empty string.`, {
                code: 'INVALID_STRING_FIELD',
                details: { fieldName, value },
            });
        }

        return value;
    }
}

/**
 * @param {number} x - Pixel x coordinate.
 * @param {number} y - Pixel y coordinate.
 * @param {number} width - Viewport width.
 * @param {number} height - Viewport height.
 * @returns {THREE.Vector2} Three normalized device coordinate.
 */
function pixelToNdc(x, y, width, height) {
    return new THREE.Vector2(
        ((x + 0.5) / width) * 2 - 1,
        1 - ((y + 0.5) / height) * 2,
    );
}

/**
 * @param {THREE.Vector3} vector - Three point.
 * @returns {Position} Algorithm coordinate point.
 */
function mapThreePointToAlgorithm(vector) {
    return Object.freeze([vector.x, -vector.z, vector.y]);
}

/**
 * @param {THREE.Vector3} vector - Three direction.
 * @returns {Position} Algorithm coordinate direction before normalization.
 */
function mapThreeDirectionToAlgorithm(vector) {
    return Object.freeze([vector.x, -vector.z, vector.y]);
}

/**
 * @param {Position} vector - Candidate vector.
 * @returns {UnitVector3} Normalized vector.
 */
function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    if (!Number.isFinite(length) || length === 0) {
        throw new ReconciliationConfigurationError('Cannot normalize an empty Three bridge vector.', {
            code: 'INVALID_THREE_SCENE_BRIDGE_VECTOR',
            details: { vector },
        });
    }

    return Object.freeze([
        vector[0] / length,
        vector[1] / length,
        vector[2] / length,
    ]);
}

/**
 * @param {THREE.Vector3} vector - Three vector.
 * @returns {Position} Frozen vector tuple.
 */
function freezeVector3(vector) {
    return Object.freeze([vector.x, vector.y, vector.z]);
}

/**
 * @param {unknown} value - Candidate object.
 * @returns {value is Record<string, unknown>} Whether value is a plain object.
 */
function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {{
 *     sceneId: string;
 *     coordinateMappingId: ThreeToAlgorithmCoordinateMappingId;
 *     pixels: readonly SoftShaderScenePixelInput[];
 * }} request - Summary input.
 * @returns {ThreeSceneSoftShaderBridgeCaptureSummary} Capture summary.
 */
function summarizePixels({ sceneId, coordinateMappingId, pixels }) {
    const hitDistances = pixels
        .map((pixel) => pixel.sceneIntersection?.distanceMeters)
        .filter(Number.isFinite);

    return Object.freeze({
        sceneId,
        selectedPixelCount: pixels.length,
        hitPixelCount: pixels.filter((pixel) => pixel.sceneIntersection?.kind === 'hit').length,
        noHitPixelCount: pixels.filter((pixel) => pixel.sceneIntersection?.kind === 'no-hit').length,
        invalidPixelCount: pixels.filter((pixel) => pixel.sceneIntersection?.kind === 'invalid').length,
        minHitDistanceMeters: hitDistances.length > 0 ? Math.min(...hitDistances) : null,
        maxHitDistanceMeters: hitDistances.length > 0 ? Math.max(...hitDistances) : null,
        coordinateMappingId,
    });
}

