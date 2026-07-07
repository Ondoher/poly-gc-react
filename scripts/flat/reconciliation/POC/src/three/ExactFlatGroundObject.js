// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, ThreeGateway scene synchronization.
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, geometry-owned hit distance.

import * as THREE from 'three';

const EPSILON = 1e-9;

export default class ExactFlatGroundObject extends THREE.Object3D {
    /**
     * @param {ExactFlatGroundObjectConfig} configuration - Exact flat ground endpoint configuration.
     */
    constructor(configuration) {
        super();

        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('ExactFlatGroundObject configuration is required.');
        }

        const {
            centerSceneUnits = [0, 0, 0],
            widthSceneUnits,
            depthSceneUnits,
            metersPerSceneUnit,
            spectralReferenceId,
            name = 'exact-flat-ground-endpoint',
        } = configuration;

        if (
            !Number.isFinite(widthSceneUnits)
            || widthSceneUnits <= 0
            || !Number.isFinite(depthSceneUnits)
            || depthSceneUnits <= 0
            || !Number.isFinite(metersPerSceneUnit)
            || metersPerSceneUnit <= 0
            || !Array.isArray(centerSceneUnits)
            || centerSceneUnits.length !== 3
            || !centerSceneUnits.every(Number.isFinite)
        ) {
            throw new TypeError('ExactFlatGroundObject requires finite plane and scale values.');
        }

        this.name = name;
        this.position.set(centerSceneUnits[0], centerSceneUnits[1], centerSceneUnits[2]);
        this.userData.spectralReferenceId = spectralReferenceId ?? null;
        this.userData.endpointKind = 'geometry-ground-boundary';
        this.userData.metersPerSceneUnit = metersPerSceneUnit;
        this._configuration = Object.freeze({
            widthSceneUnits,
            depthSceneUnits,
            metersPerSceneUnit,
        });
    }

    /**
     * @param {THREE.Raycaster} raycaster - Active Three raycaster.
     * @param {THREE.Intersection[]} intersects - Mutable Three intersection list.
     * @returns {void}
     */
    raycast(raycaster, intersects) {
        const center = new THREE.Vector3();

        center.setFromMatrixPosition(this.matrixWorld);

        const ray = raycaster.ray;
        if (Math.abs(ray.direction.y) <= EPSILON) {
            return;
        }

        const distance = (center.y - ray.origin.y) / ray.direction.y;
        if (!Number.isFinite(distance) || distance < raycaster.near || distance > raycaster.far) {
            return;
        }

        const point = ray.at(distance, new THREE.Vector3());
        const halfWidth = this._configuration.widthSceneUnits / 2;
        const halfDepth = this._configuration.depthSceneUnits / 2;

        if (
            Math.abs(point.x - center.x) > halfWidth
            || Math.abs(point.z - center.z) > halfDepth
        ) {
            return;
        }

        intersects.push({
            distance,
            point,
            object: this,
            normal: new THREE.Vector3(0, 1, 0),
        });
    }
}
