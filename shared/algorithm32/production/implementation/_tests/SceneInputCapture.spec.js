import { readFileSync } from 'node:fs';

import { SceneInputCapture } from '../SceneInputCapture.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../SceneInputCapture.js', import.meta.url), 'utf8');
}

describe('SceneInputCapture', () => {
	it('keeps the renderer input capture pass documented', () => {
		const source = readSource();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class SceneInputCapture');
		expect(source).toContain('render(renderer)');
		expect(source).toContain('capture(renderer)');
		expect(source).toContain('setSize(width, height)');
		expect(source).toContain('bindingValues()');
		expect(source).toContain('renderer-override-material-distance-plus-hit-mask');
	});

	it('creates reusable depth and hit textures for runtime bindings', () => {
		const THREE = createThreeDouble();
		const capture = new SceneInputCapture({
			THREE,
			scene: createSceneDouble(),
			camera: createCameraDouble(),
			width: 8,
			height: 4,
			sceneDepthMaxMeters: 250,
			distanceMultiplier: 3,
		});
		const bindingValues = capture.bindingValues();

		expect(bindingValues['runtime.sceneDepthTexture']).toBe(capture.depthTexture);
		expect(bindingValues['runtime.sceneHitTexture']).toBe(capture.hitTexture);
		expect(bindingValues['runtime.viewportPixels'].x).toBe(8);
		expect(bindingValues['runtime.viewportPixels'].y).toBe(4);
		expect(capture.needsSwap).toBe(false);
		expect(capture._depthMaterial.parameters.fragmentShader).toContain('packNormalizedDistance24');
		expect(capture._hitMaterial.parameters.fragmentShader).toContain('gl_FragColor = vec4(1.0);');
		expect(capture.getDiagnostics()).toEqual(jasmine.objectContaining({
			kind: 'algorithm32-scene-input-capture-pass',
			status: 'ready',
			sceneDepthMaxMeters: 250,
			distanceMultiplier: 3,
			viewportPixels: [8, 4],
		}));
	});

	it('renders distance and hit-mask passes while restoring scene and renderer state', () => {
		const scene = createSceneDouble();
		const camera = createCameraDouble();
		const renderer = createRendererDouble();
		const capture = new SceneInputCapture({
			THREE: createThreeDouble(),
			scene,
			camera,
			width: 2,
			height: 2,
		});

		capture.render(renderer, {}, {});

		expect(camera.worldPositionRequests).toBe(2);
		expect(renderer.render.calls.count()).toBe(2);
		expect(renderer.renderedOverrideMaterials).toEqual([
			capture._depthMaterial,
			capture._hitMaterial,
		]);
		expect(scene.overrideMaterial).toBe('original-material');
		expect(scene.background).toBe('original-background');
		expect(renderer.currentTarget).toBe('previous-target');
		expect(renderer.clear).toHaveBeenCalledTimes(2);
		expect(capture.getDiagnostics()).toEqual(jasmine.objectContaining({
			frameCount: 1,
		}));
	});

	it('resizes targets, updates viewport pixels, and disposes resources', () => {
		const capture = new SceneInputCapture({
			THREE: createThreeDouble(),
			scene: createSceneDouble(),
			camera: createCameraDouble(),
			width: 2,
			height: 2,
		});

		capture.setSize(16, 9);
		capture.dispose();

		expect(capture.viewportPixels.x).toBe(16);
		expect(capture.viewportPixels.y).toBe(9);
		expect(capture._depthTarget.width).toBe(16);
		expect(capture._depthTarget.height).toBe(9);
		expect(capture._hitTarget.width).toBe(16);
		expect(capture._hitTarget.height).toBe(9);
		expect(capture._depthMaterial.disposed).toBe(true);
		expect(capture._hitMaterial.disposed).toBe(true);
		expect(capture._depthTarget.disposed).toBe(true);
		expect(capture._hitTarget.disposed).toBe(true);
		expect(capture.getDiagnostics()).toEqual(jasmine.objectContaining({
			status: 'disposed',
		}));
	});

	it('fails loudly when required Three constructors are missing', () => {
		expect(() => new SceneInputCapture({
			THREE: {},
			scene: {},
			camera: {},
		})).toThrowError(/THREE\.WebGLRenderTarget/);
	});
});

/**
 * Create a fake Three namespace.
 *
 * @returns {object} Return fake Three constructors.
 */
function createThreeDouble() {
	return {
		RGBAFormat: 'RGBAFormat',
		UnsignedByteType: 'UnsignedByteType',
		ClampToEdgeWrapping: 'ClampToEdgeWrapping',
		Color: class Color {
			constructor(value = 'black') {
				this.value = value;
			}
		},
		Vector2: class Vector2 {
			constructor(x, y) {
				this.x = x;
				this.y = y;
			}

			set(x, y) {
				this.x = x;
				this.y = y;
			}
		},
		Vector3: class Vector3 {
			constructor(x = 0, y = 0, z = 0) {
				this.set(x, y, z);
			}

			set(x, y, z) {
				this.x = x;
				this.y = y;
				this.z = z;
			}
		},
		WebGLRenderTarget: class WebGLRenderTarget {
			constructor(width, height, options) {
				this.width = width;
				this.height = height;
				this.options = options;
				this.texture = {};
				this.disposed = false;
			}

			setSize(width, height) {
				this.width = width;
				this.height = height;
			}

			dispose() {
				this.disposed = true;
			}
		},
		ShaderMaterial: class ShaderMaterial {
			constructor(parameters) {
				this.parameters = parameters;
				this.uniforms = parameters.uniforms ?? {};
				this.disposed = false;
			}

			dispose() {
				this.disposed = true;
			}
		},
	};
}

/**
 * Create a fake Three scene.
 *
 * @returns {object} Return scene double.
 */
function createSceneDouble() {
	return {
		overrideMaterial: 'original-material',
		background: 'original-background',
	};
}

/**
 * Create a fake Three camera.
 *
 * @returns {object} Return camera double.
 */
function createCameraDouble() {
	return {
		worldPositionRequests: 0,
		getWorldPosition(target) {
			this.worldPositionRequests += 1;
			target.set(1, 2, 3);
			return target;
		},
	};
}

/**
 * Create a fake renderer.
 *
 * @returns {object} Return renderer double.
 */
function createRendererDouble() {
	const renderer = {
		currentTarget: 'previous-target',
		getRenderTarget() {
			return this.currentTarget;
		},
		setRenderTarget: jasmine.createSpy('setRenderTarget').and.callFake(function setRenderTarget(target) {
			renderer.currentTarget = target;
		}),
		getClearColor: jasmine.createSpy('getClearColor').and.callFake((color) => color),
		getClearAlpha: jasmine.createSpy('getClearAlpha').and.returnValue(0.5),
		setClearColor: jasmine.createSpy('setClearColor'),
		clear: jasmine.createSpy('clear'),
		renderedOverrideMaterials: [],
		render: jasmine.createSpy('render').and.callFake((scene) => {
			renderer.renderedOverrideMaterials.push(scene.overrideMaterial);
		}),
	};

	return renderer;
}
