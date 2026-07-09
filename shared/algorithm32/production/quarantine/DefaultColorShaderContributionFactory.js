/**
 * Create the default color/output contribution for scene-preserving shader setup.
 */
export class DefaultColorShaderContributionFactory {
	/**
	 * Create the default color contribution for one descriptor.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the default color contribution.
	 */
	createContribution(descriptor) {
		if (!descriptor?.color) {
			throw new TypeError('Default color shader contribution requires a descriptor color section.');
		}

		return Object.freeze({
			id: 'color-default-scene-preserving-output',
			owner: 'color',
			descriptorFingerprint: descriptor.color.fingerprint,
			compatibilityTags: descriptor.color.compatibilityTags,
			provides: Object.freeze([
				'color.composeSceneColor',
				'color.encodeOutput',
			]),
			requires: Object.freeze([
				'runtime.initialState',
			]),
			defines: Object.freeze([]),
			uniforms: Object.freeze([]),
			textures: Object.freeze([]),
			functions: Object.freeze([]),
			mainHooks: Object.freeze([
				block('color-compose-scene-preserving-output', 'composeSceneColor', 0, 'state.outputRgba = vec4(state.sceneDisplayRgb, 1.0);'),
				block('color-encode-output', 'encodeOutput', 0, 'outColor = state.outputRgba;'),
			]),
			bindingRequirements: Object.freeze([]),
			diagnostics: Object.freeze({
				mode: 'scene-preserving-default',
			}),
		});
	}
}

/**
 * Create one source block.
 *
 * @param {string} id - Supplies the block id.
 * @param {ShaderSourceSlot} slot - Supplies the assembly slot.
 * @param {number} order - Supplies the slot-local order.
 * @param {string} code - Supplies GLSL source.
 * @returns {ShaderSourceBlock} Return source block.
 */
function block(id, slot, order, code) {
	return Object.freeze({
		id,
		slot,
		order,
		code,
	});
}

export default DefaultColorShaderContributionFactory;
