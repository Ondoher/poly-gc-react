import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import sharp from 'sharp';
import { ROOT_DIR } from '../shared/asset-paths.js';

/**
 * Applies base-tile material texture maps declared in base tile metadata.
 *
 * @param {THREE.Object3D} root - Loaded base tile scene.
 * @param {object} baseTileVariant - Base tile manifest/metadata object.
 * @returns {Promise<string[]>} Mesh names that received a texture map.
 */
export async function applyBaseTileTextureMaterials(root, baseTileVariant) {
	if (baseTileVariant?.previewMaterialSource === 'embedded') {
		return [];
	}

	const materialEntries = Object.values(baseTileVariant.material || {});
	const applied = [];

	for (const entry of materialEntries) {
		const texturePath = entry?.textureMap || entry?.baseColorTexture || entry?.texture;
		const meshName = entry?.meshName;
		if (!meshName || !texturePath) {
			continue;
		}

		const mesh = findFirstMeshByName(root, meshName);
		if (!mesh) {
			continue;
		}

		const texture = await loadDataTexture(texturePath);
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const material of materials) {
			if (!material) {
				continue;
			}

			material.map = texture.clone();
			material.map.name = `${material.name || mesh.name}-baseColorTexture`;
			material.color?.set?.(0xffffff);
			material.needsUpdate = true;
		}
		applied.push(meshName);
	}

	return applied;
}

function findFirstMeshByName(root, meshName) {
	let found = null;
	root.traverse((object) => {
		if (found || !object.isMesh || object.name !== meshName) {
			return;
		}
		found = object;
	});
	return found;
}

async function loadDataTexture(texturePath) {
	const resolved = resolveRepoPath(texturePath);
	if (!fs.existsSync(resolved)) {
		throw new Error(`Missing base tile texture: ${texturePath}.`);
	}

	const image = await sharp(resolved)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const texture = new THREE.DataTexture(
		new Uint8Array(image.data),
		image.info.width,
		image.info.height,
		THREE.RGBAFormat,
	);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.needsUpdate = true;
	return texture;
}

function resolveRepoPath(filename) {
	return filename ? path.resolve(ROOT_DIR, filename) : '';
}
