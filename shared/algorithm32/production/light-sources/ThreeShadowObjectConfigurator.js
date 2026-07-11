/**
 * Configure an app-authored Three object tree for source-owned shadows.
 *
 * @param {unknown} object - Supplies a Three object or mesh.
 * @param {object} owner - Supplies source-owned shadow metadata.
 * @param {object} [request] - Supplies shadow flag overrides.
 * @returns {unknown} The configured object.
 */
export function configureThreeShadowObject(object, owner, request = {}) {
	if (!object || typeof object !== 'object') {
		throw new TypeError('configureThreeShadowObject requires a Three object.');
	}

	const castShadow = booleanOrDefault(request.castShadow, true);
	const receiveShadow = booleanOrDefault(request.receiveShadow, true);
	const includeDescendants = request.includeDescendants !== false;
	const shadowPolicy = request.shadowPolicy ?? owner.shadowPolicy;
	const sourceKey = request.sourceKey ?? owner.sourceKey;
	const layerIndex = layerIndexOrNull(request.layerIndex);
	const configuredNodes = [];
	const configureNode = (node) => {
		if (!node || typeof node !== 'object') {
			return;
		}

		node.castShadow = castShadow;
		node.receiveShadow = receiveShadow;
		node.userData ??= {};
		node.userData.algorithm32ShadowObject = true;
		node.userData.shadowPolicy = shadowPolicy;
		node.userData.shadowSourceKey = sourceKey;
		node.userData.shadowConfigurationPolicy = 'source-owned-three-shadow-object-flags';
		if (layerIndex !== null && node.layers && typeof node.layers.enable === 'function') {
			node.layers.enable(layerIndex);
			node.userData.shadowLayerIndex = layerIndex;
		}
		configuredNodes.push(node);
	};

	if (includeDescendants && typeof object.traverse === 'function') {
		object.traverse(configureNode);
	} else {
		configureNode(object);
	}

	object.userData ??= {};
	object.userData.algorithm32ShadowConfiguration = Object.freeze({
		owner: owner.owner,
		sourceKey,
		shadowPolicy,
		castShadow,
		receiveShadow,
		includeDescendants,
		layerIndex,
		configuredNodeCount: configuredNodes.length,
	});

	return object;
}

/**
 * Resolve a boolean option with fallback.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {boolean} fallback - Supplies fallback value.
 * @returns {boolean} Boolean value.
 */
function booleanOrDefault(value, fallback) {
	return typeof value === 'boolean' ? value : fallback;
}

/**
 * Resolve optional Three layer index.
 *
 * @param {unknown} value - Supplies candidate layer index.
 * @returns {number | null} Layer index or null.
 */
function layerIndexOrNull(value) {
	if (value == null) {
		return null;
	}

	if (!Number.isInteger(value) || value < 0 || value > 31) {
		throw new RangeError('layerIndex must be an integer from 0 to 31.');
	}

	return value;
}
