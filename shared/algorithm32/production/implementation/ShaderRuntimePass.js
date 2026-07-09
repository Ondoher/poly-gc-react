const GLSL_DIRECTIVE_PREFIX = String.fromCharCode(35);

/**
 * Composer-compatible fullscreen shader pass owned by ShaderBuilder.
 */
export class ShaderRuntimePass {
	/**
	 * Track whether the pass participates in composer rendering.
	 *
	 * @type {boolean}
	 */
	enabled = true;

	/**
	 * Track whether the composer should swap buffers after this pass.
	 *
	 * @type {boolean}
	 */
	needsSwap = false;

	/**
	 * Track whether the pass should clear before drawing.
	 *
	 * @type {boolean}
	 */
	clear = false;

	/**
	 * Track whether this pass renders directly to the screen.
	 *
	 * @type {boolean}
	 */
	renderToScreen = false;

	/**
	 * Store runtime uniforms.
	 *
	 * @type {Record<string, { value: unknown }>}
	 */
	_uniforms;

	/**
	 * Store the Three shader material.
	 *
	 * @type {unknown}
	 */
	_material;

	/**
	 * Store the fullscreen geometry.
	 *
	 * @type {unknown}
	 */
	_geometry;

	/**
	 * Store the fullscreen mesh.
	 *
	 * @type {unknown}
	 */
	_mesh;

	/**
	 * Store the internal pass scene.
	 *
	 * @type {unknown}
	 */
	_scene;

	/**
	 * Store the internal pass camera.
	 *
	 * @type {unknown}
	 */
	_camera;

	/**
	 * Store the source hash for diagnostics.
	 *
	 * @type {string}
	 */
	_sourceHash;

	/**
	 * Store optional runtime logger.
	 *
	 * @type {Console | null}
	 */
	_logger;

	/**
	 * Store optional renderer-produced scene input texture provider.
	 *
	 * @type {SceneInputCapture | null}
	 */
	_sceneInputCapture;

	/**
	 * Track render count.
	 *
	 * @type {number}
	 */
	_frameCount = 0;

	/**
	 * Track non-fatal render errors.
	 *
	 * @type {number}
	 */
	_renderErrorCount = 0;

	/**
	 * Store the last render error message.
	 *
	 * @type {string | null}
	 */
	_lastRenderError = null;

	/**
	 * Track whether this pass has been disposed.
	 *
	 * @type {boolean}
	 */
	_disposed = false;

	/**
	 * Create an installed runtime shader pass.
	 *
	 * @param {ShaderRuntimePassConfiguration} configuration - Supplies pass setup.
	 */
	constructor(configuration) {
		if (!configuration || typeof configuration !== 'object') {
			throw new TypeError('Shader runtime pass configuration is required.');
		}

		const THREE = configuration.THREE;

		for (const constructorName of ['ShaderMaterial', 'PlaneGeometry', 'Mesh', 'Scene', 'OrthographicCamera']) {
			if (typeof THREE?.[constructorName] !== 'function') {
				throw new TypeError(`Shader runtime pass requires THREE.${constructorName}.`);
			}
		}

		this._uniforms = configuration.uniforms ?? {};
		this._sourceHash = configuration.sourceHash;
		this._logger = configuration.logger ?? null;
		this._sceneInputCapture = configuration.sceneInputCapture ?? null;
		this._material = new THREE.ShaderMaterial({
			glslVersion: THREE.GLSL3 ?? '300 es',
			vertexShader: stripGlslVersion(fullscreenVertexShader()),
			fragmentShader: stripGlslVersion(configuration.fragmentShaderSource),
			uniforms: this._uniforms,
			depthTest: false,
			depthWrite: false,
		});
		this._geometry = new THREE.PlaneGeometry(2, 2);
		this._mesh = new THREE.Mesh(this._geometry, this._material);
		this._scene = new THREE.Scene();
		this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this._scene.add(this._mesh);
	}

	/**
	 * Return the material owned by the pass.
	 *
	 * @returns {unknown} Return the shader material.
	 */
	get material() {
		return this._material;
	}

	/**
	 * Return the uniforms owned by the pass.
	 *
	 * @returns {Record<string, { value: unknown }>} Return the uniforms.
	 */
	get uniforms() {
		return this._uniforms;
	}

	/**
	 * React to composer resize notifications.
	 *
	 * @param {number} width - Supplies the width in pixels.
	 * @param {number} height - Supplies the height in pixels.
	 * @returns {void}
	 */
	setSize(width, height) {
		const resolutionUniform = this._uniforms.uResolution;
		const viewportUniform = this._uniforms.uViewportPixels;

		if (resolutionUniform?.value && typeof resolutionUniform.value.set === 'function') {
			resolutionUniform.value.set(width, height);
		} else if (resolutionUniform) {
			resolutionUniform.value = [width, height];
		}

		if (viewportUniform?.value && typeof viewportUniform.value.set === 'function') {
			viewportUniform.value.set(width, height);
		} else if (viewportUniform) {
			viewportUniform.value = [width, height];
		}

	}

	/**
	 * Render the fullscreen shader pass for one composer invocation.
	 *
	 * @param {unknown} renderer - Supplies the active renderer.
	 * @param {unknown} writeBuffer - Supplies the composer write buffer.
	 * @param {unknown} readBuffer - Supplies the composer read buffer.
	 * @returns {void}
	 */
	render(renderer, writeBuffer, readBuffer) {
		if (this._disposed || !this.enabled) {
			return;
		}

		try {
			if (this._uniforms.uSceneColorTexture) {
				this._uniforms.uSceneColorTexture.value = readBuffer?.texture ?? null;
			}

			if (this._sceneInputCapture) {
				if (this._uniforms.uSceneDepthTexture) {
					this._uniforms.uSceneDepthTexture.value = this._sceneInputCapture.depthTexture;
				}

				if (this._uniforms.uSceneHitTexture) {
					this._uniforms.uSceneHitTexture.value = this._sceneInputCapture.hitTexture;
				}
			}

			if (typeof renderer?.setRenderTarget === 'function') {
				renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
			}

			if (this.clear && typeof renderer?.clear === 'function') {
				renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
			}

			if (typeof renderer?.render === 'function') {
				renderer.render(this._scene, this._camera);
			}

			this._frameCount += 1;
		} catch (error) {
			this._renderErrorCount += 1;
			this._lastRenderError = error instanceof Error ? error.message : String(error);
			this._logger?.warn?.('Algorithm32 shader pass render failed; keeping the previous composer state.', error);
		}
	}

	/**
	 * Return internal pass diagnostics.
	 *
	 * @returns {unknown} Return diagnostics.
	 */
	getDiagnostics() {
		return Object.freeze({
			status: this._disposed ? 'disposed' : 'ready',
			sourceHash: this._sourceHash,
			frameCount: this._frameCount,
			renderErrorCount: this._renderErrorCount,
			lastRenderError: this._lastRenderError,
			sceneInputCapture: this._sceneInputCapture?.getDiagnostics?.() ?? null,
		});
	}

	/**
	 * Dispose resources owned by the pass.
	 *
	 * @returns {void}
	 */
	dispose() {
		if (this._disposed) {
			return;
		}

		this._disposed = true;
		this.enabled = false;
		this._material?.dispose?.();
		this._geometry?.dispose?.();
	}
}

/**
 * Return a fullscreen GLSL3 vertex shader.
 *
 * @returns {string} Return the vertex shader source.
 */
function fullscreenVertexShader() {
	return `${GLSL_DIRECTIVE_PREFIX}version 300 es
precision highp float;
in vec3 position;
out vec2 vUv;

void main() {
	vUv = position.xy * 0.5 + 0.5;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
}

/**
 * Strip a GLSL version directive before passing GLSL3 source to Three.
 *
 * @param {string} source - Supplies shader source.
 * @returns {string} Return source without its version directive.
 */
function stripGlslVersion(source) {
	return source.replace(new RegExp(`^${GLSL_DIRECTIVE_PREFIX}version\\s+300\\s+es\\s*\\n`), '');
}

export default ShaderRuntimePass;
