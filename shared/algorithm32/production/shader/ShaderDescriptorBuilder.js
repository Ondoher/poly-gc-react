import { stableHash } from './stableHash.js';

/**
 * Build shader descriptors from the facade-owned shared model snapshot.
 */
export class ShaderDescriptorBuilder {
	/**
	 * Build one shader descriptor.
	 *
	 * @param {ShaderDescriptorBuildRequest} request - Supplies shared model and runtime facts.
	 * @returns {Algorithm32ShaderDescriptor} Return the shader descriptor.
	 */
	build(request) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Shader descriptor build request is required.');
		}

		const snapshot = request.snapshot ?? request.model?.snapshot?.();

		if (!snapshot) {
			throw new TypeError('Shader descriptor build request requires a shared model snapshot.');
		}

		const color = request.color ?? request.config?.config?.color ?? null;

		if (typeof color?.describe !== 'function') {
			throw new TypeError('Shader descriptor build requires a Color abstraction with describe().');
		}

		const colorDescriptor = color.describe();
		const shaderConfig = request.config?.config?.shader ?? {};
		const compatibilityTags = Object.freeze([
			'algorithm32',
			'shared-model-descriptor',
			...(request.compatibilityTags ?? []),
		]);
		const sections = Object.freeze({
			spectralBasis: section('spectral-basis', ['spectral-basis'], snapshot.spectral),
			geometry: section('geometry', ['geometry'], snapshot.geometry),
			atmosphere: section('atmosphere', ['atmosphere'], snapshot.atmosphere),
			lightSource: section('light-source', ['light-source'], snapshot.lightSource),
			cache: section('cache', ['incident-radiance-cache'], request.cacheDescriptor ?? {
				cacheKind: 'none',
				sourceKey: snapshot.lightSource.id ?? snapshot.lightSource.kind,
				version: snapshot.version,
			}),
			transport: section('transport', ['algorithm32-transport'], {
				execution: request.config?.config?.execution ?? {},
				spectralChannelCount: snapshot.spectral.channelCount,
			}),
			color: section('color', ['display-color'], colorDescriptor),
			runtime: section('runtime', ['three-fragment-shader'], {
				mode: shaderConfig.mode ?? 'default',
				cachePolicy: shaderConfig.cachePolicy ?? null,
				capabilityPolicy: shaderConfig.capabilityPolicy ?? null,
				renderTargetPolicy: shaderConfig.renderTargetPolicy ?? null,
				modelVersion: snapshot.version,
			}),
		});
		const body = Object.freeze({
			descriptorId: 'algorithm32-shader-descriptor',
			variantId: request.variantId ?? `model-v${snapshot.version}`,
			compatibilityTags,
			...sections,
		});

		return Object.freeze({
			...body,
			fingerprint: stableHash(body),
		});
	}
}

/**
 * Create one descriptor section.
 *
 * @param {string} descriptorId - Supplies the section id.
 * @param {readonly string[]} compatibilityTags - Supplies compatibility tags.
 * @param {unknown} facts - Supplies section facts.
 * @returns {ShaderDescriptorSection} Return the section.
 */
function section(descriptorId, compatibilityTags, facts) {
	const body = Object.freeze({
		descriptorId,
		compatibilityTags: Object.freeze([...compatibilityTags]),
		facts: deepFreeze(cloneJson(facts)),
	});

	return Object.freeze({
		...body,
		fingerprint: stableHash(body),
	});
}

/**
 * Clone JSON-compatible data.
 *
 * @param {unknown} value - Supplies the value.
 * @returns {unknown} Return the cloned value.
 */
function cloneJson(value) {
	return JSON.parse(JSON.stringify(value));
}

/**
 * Deep-freeze JSON-compatible data.
 *
 * @param {unknown} value - Supplies the value.
 * @returns {unknown} Return the frozen value.
 */
function deepFreeze(value) {
	if (Array.isArray(value)) {
		value.forEach(deepFreeze);
	} else if (value && typeof value === 'object') {
		Object.values(value).forEach(deepFreeze);
	}

	return Object.freeze(value);
}

export default ShaderDescriptorBuilder;
