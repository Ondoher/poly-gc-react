import { readFileSync } from 'node:fs';

import { ShaderRuntimePass } from '../ShaderRuntimePass.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../ShaderRuntimePass.js', import.meta.url), 'utf8');
}

/**
 * Create a fake Three namespace.
 *
 * @returns {object} Return fake Three constructors.
 */
function createThreeDouble() {
	return {
		GLSL3: 'GLSL3',
		RawShaderMaterial: class RawShaderMaterial {
			constructor(parameters) {
				this.parameters = parameters;
				this.uniforms = parameters.uniforms;
				this.disposed = false;
			}

			dispose() {
				this.disposed = true;
			}
		},
		PlaneGeometry: class PlaneGeometry {
			constructor(width, height) {
				this.width = width;
				this.height = height;
				this.disposed = false;
			}

			dispose() {
				this.disposed = true;
			}
		},
		Mesh: class Mesh {
			constructor(geometry, material) {
				this.geometry = geometry;
				this.material = material;
			}
		},
		Scene: class Scene {
			constructor() {
				this.children = [];
			}

			add(child) {
				this.children.push(child);
			}
		},
		OrthographicCamera: class OrthographicCamera {
			constructor(left, right, top, bottom, near, far) {
				this.left = left;
				this.right = right;
				this.top = top;
				this.bottom = bottom;
				this.near = near;
				this.far = far;
			}
		},
	};
}

describe('ShaderRuntimePass', () => {
	it('keeps the runtime pass documented', () => {
		const source = readSource();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class ShaderRuntimePass');
		expect(source).toContain('render(renderer, writeBuffer, readBuffer)');
		expect(source).toContain('setSize(width, height)');
		expect(source).toContain('@returns {void}');
	});

	it('creates a fullscreen material from caller-provided Three constructors', () => {
		const uniforms = {
			uSceneColorTexture: {
				value: null,
			},
		};
		const pass = new ShaderRuntimePass({
			THREE: createThreeDouble(),
			fragmentShaderSource: '#version 300 es\nprecision highp float;\nout vec4 outColor;\nvoid main() { outColor = vec4(1.0); }\n',
			sourceHash: 'hash',
			uniforms,
		});

		expect(pass.needsSwap).toBe(false);
		expect(pass.material.parameters.fragmentShader).not.toContain('#version');
		expect(pass.material.uniforms).toBe(uniforms);
	});

	it('renders through the supplied renderer and binds composer scene color', () => {
		const pass = new ShaderRuntimePass({
			THREE: createThreeDouble(),
			fragmentShaderSource: '#version 300 es\nprecision highp float;\nout vec4 outColor;\nvoid main() { outColor = vec4(1.0); }\n',
			sourceHash: 'hash',
			uniforms: {
				uSceneColorTexture: {
					value: null,
				},
			},
		});
		const renderer = {
			setRenderTarget: jasmine.createSpy('setRenderTarget'),
			render: jasmine.createSpy('render'),
		};
		const writeBuffer = {};
		const readBuffer = {
			texture: {},
		};

		pass.render(renderer, writeBuffer, readBuffer);

		expect(pass.uniforms.uSceneColorTexture.value).toBe(readBuffer.texture);
		expect(renderer.setRenderTarget).toHaveBeenCalledOnceWith(writeBuffer);
		expect(renderer.render).toHaveBeenCalled();
		expect(pass.getDiagnostics()).toEqual(jasmine.objectContaining({
			status: 'ready',
			sourceHash: 'hash',
			frameCount: 1,
			renderErrorCount: 0,
		}));
	});

	it('binds renderer-produced scene depth and hit inputs from the preceding capture pass', () => {
		const sceneInputCapture = createSceneInputCaptureDouble();
		const pass = new ShaderRuntimePass({
			THREE: createThreeDouble(),
			fragmentShaderSource: '#version 300 es\nprecision highp float;\nout vec4 outColor;\nvoid main() { outColor = vec4(1.0); }\n',
			sourceHash: 'hash',
			uniforms: {
				uSceneColorTexture: {
					value: null,
				},
				uSceneDepthTexture: {
					value: null,
				},
				uSceneHitTexture: {
					value: null,
				},
			},
			sceneInputCapture,
		});
		const renderer = {
			setRenderTarget: jasmine.createSpy('setRenderTarget'),
			render: jasmine.createSpy('render'),
		};

		pass.render(renderer, {}, { texture: 'scene-color' });

		expect(sceneInputCapture.capture).not.toHaveBeenCalled();
		expect(pass.uniforms.uSceneColorTexture.value).toBe('scene-color');
		expect(pass.uniforms.uSceneDepthTexture.value).toBe(sceneInputCapture.depthTexture);
		expect(pass.uniforms.uSceneHitTexture.value).toBe(sceneInputCapture.hitTexture);
		expect(pass.getDiagnostics()).toEqual(jasmine.objectContaining({
			sceneInputCapture: jasmine.objectContaining({
				status: 'ready',
			}),
		}));
	});

	it('logs live render failures without throwing', () => {
		const logger = {
			warn: jasmine.createSpy('warn'),
		};
		const pass = new ShaderRuntimePass({
			THREE: createThreeDouble(),
			fragmentShaderSource: '#version 300 es\nprecision highp float;\nout vec4 outColor;\nvoid main() { outColor = vec4(1.0); }\n',
			sourceHash: 'hash',
			uniforms: {},
			logger,
		});
		const renderer = {
			render() {
				throw new Error('render failed');
			},
		};

		expect(() => pass.render(renderer, {}, {})).not.toThrow();
		expect(logger.warn).toHaveBeenCalled();
		expect(pass.getDiagnostics()).toEqual(jasmine.objectContaining({
			renderErrorCount: 1,
			lastRenderError: 'render failed',
		}));
	});

	it('updates resolution uniforms and disposes owned resources', () => {
		const resolutionValue = {
			set: jasmine.createSpy('set'),
		};
		const sceneInputCapture = createSceneInputCaptureDouble();
		const pass = new ShaderRuntimePass({
			THREE: createThreeDouble(),
			fragmentShaderSource: '#version 300 es\nprecision highp float;\nout vec4 outColor;\nvoid main() { outColor = vec4(1.0); }\n',
			sourceHash: 'hash',
			uniforms: {
				uResolution: {
					value: resolutionValue,
				},
				uViewportPixels: {
					value: [1, 1],
				},
			},
			sceneInputCapture,
		});

		pass.setSize(640, 360);
		pass.dispose();

		expect(resolutionValue.set).toHaveBeenCalledOnceWith(640, 360);
		expect(pass.uniforms.uViewportPixels.value).toEqual([640, 360]);
		expect(sceneInputCapture.setSize).not.toHaveBeenCalled();
		expect(sceneInputCapture.dispose).not.toHaveBeenCalled();
		expect(pass.enabled).toBe(false);
		expect(pass.getDiagnostics()).toEqual(jasmine.objectContaining({
			status: 'disposed',
		}));
	});
});

/**
 * Create a fake scene input capture helper.
 *
 * @returns {object} Return capture double.
 */
function createSceneInputCaptureDouble() {
	return {
		depthTexture: {
			name: 'depth',
		},
		hitTexture: {
			name: 'hit',
		},
		capture: jasmine.createSpy('capture'),
		setSize: jasmine.createSpy('setSize'),
		dispose: jasmine.createSpy('dispose'),
		getDiagnostics() {
			return {
				status: 'ready',
			};
		},
	};
}
