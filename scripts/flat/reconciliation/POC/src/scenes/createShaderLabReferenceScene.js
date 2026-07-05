// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.1.3.
// - agents/topics/apps/flat/reconciliation/shader-test-design.md, objective scene construction.
// - scripts/flat/algorithm32-shader-lab/node-three-reference.js, simple Three scene bridge precedent.

import * as THREE from 'three';

/**
 * @returns {ReconciliationControlledThreeScene} Controlled Node/Three scene for the first bridge probe.
 */
export default function createShaderLabReferenceScene() {
    const viewportPixels = Object.freeze([9, 7]);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, viewportPixels[0] / viewportPixels[1], 0.1, 200);
    camera.position.set(0, 1.5, 0);
    camera.lookAt(new THREE.Vector3(0, 1.2, -12));
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const meshes = [];

    const card = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 3),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    card.name = 'fixture-card-center';
    card.position.set(0, 1.35, -10);
    card.userData = Object.freeze({
        kind: 'fixture-card',
        spectralReferenceId: 'fixture-neutral-medium',
    });
    card.updateMatrixWorld(true);
    scene.add(card);
    meshes.push(card);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 36),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    ground.name = 'fixture-ground-plane';
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -18);
    ground.userData = Object.freeze({
        kind: 'fixture-ground',
        spectralReferenceId: 'fixture-ground-matte',
    });
    ground.updateMatrixWorld(true);
    scene.add(ground);
    meshes.push(ground);

    scene.updateMatrixWorld(true);

    return Object.freeze({
        sceneId: 'shader-lab-node-controlled-reference',
        scene,
        camera,
        meshes: Object.freeze(meshes),
        viewportPixels,
        selectedPixels: Object.freeze([
            Object.freeze({ pixelId: 'upper-sky-control', x: 4, y: 0 }),
            Object.freeze({ pixelId: 'center-card-hit', x: 4, y: 3 }),
            Object.freeze({ pixelId: 'lower-ground-hit', x: 4, y: 6 }),
        ]),
        metadata: Object.freeze({
            lineage: 'algorithm32-shader-lab-node-three-reference',
            purpose: 'Node-only raycaster bridge smoke scene with sky, card hit, and ground hit selected pixels.',
        }),
    });
}

