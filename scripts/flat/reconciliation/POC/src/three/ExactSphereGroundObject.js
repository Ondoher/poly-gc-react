// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, ThreeGateway scene synchronization.
// - tmp/atmosphere/reconciliation/209-m3-cpu-three-spherical-ground-object, triangle-mesh horizon mismatch.

import * as THREE from 'three';

export default class ExactSphereGroundObject extends THREE.Object3D {
    /**
     * @param {ExactSphereGroundObjectConfig} configuration - Exact sphere endpoint configuration.
     */
    constructor(configuration) {
        super();

        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('ExactSphereGroundObject configuration is required.');
        }

        const {
            radiusSceneUnits,
            centerSceneUnits,
            metersPerSceneUnit,
            spectralReferenceId,
            name = 'exact-sphere-ground-endpoint',
        } = configuration;

        if (
            !Number.isFinite(radiusSceneUnits)
            || radiusSceneUnits <= 0
            || !Number.isFinite(metersPerSceneUnit)
            || metersPerSceneUnit <= 0
            || !Array.isArray(centerSceneUnits)
            || centerSceneUnits.length !== 3
            || !centerSceneUnits.every(Number.isFinite)
        ) {
            throw new TypeError('ExactSphereGroundObject requires finite sphere and scale values.');
        }

        this.name = name;
        this.position.set(centerSceneUnits[0], centerSceneUnits[1], centerSceneUnits[2]);
        this.userData.spectralReferenceId = spectralReferenceId ?? null;
        this.userData.endpointKind = 'geometry-ground-boundary';
        this.userData.metersPerSceneUnit = metersPerSceneUnit;
        this._configuration = Object.freeze({
            radiusSceneUnits,
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
        const oc = new THREE.Vector3().subVectors(ray.origin, center);
        const b = oc.dot(ray.direction);
        const c = oc.dot(oc) - this._configuration.radiusSceneUnits ** 2;
        const discriminant = b * b - c;

        if (discriminant < 0) {
            return;
        }

        const root = Math.sqrt(discriminant);
        const near = -b - root;
        const far = -b + root;
        const distance = near >= raycaster.near ? near : far >= raycaster.near ? far : null;

        if (!Number.isFinite(distance) || distance < raycaster.near || distance > raycaster.far) {
            return;
        }

        const point = ray.at(distance, new THREE.Vector3());
        const normal = new THREE.Vector3().subVectors(point, center).normalize();

        intersects.push({
            distance,
            point,
            object: this,
            normal,
        });
    }
}
