import { readFileSync } from 'node:fs';

import { ShaderBuilder } from '../ShaderBuilder.js';
import { ShaderDescriptorBuilder } from '../../shader/ShaderDescriptorBuilder.js';

/**
 * Read the ShaderBuilder implementation source.
 *
 * @returns {string} The ShaderBuilder source text.
 */
function readShaderBuilderSource() {
	return readFileSync(new URL('../ShaderBuilder.js', import.meta.url), 'utf8');
}

/**
 * Read the implementation-local ambient type source.
 *
 * @returns {string} The implementation type source text.
 */
function readImplementationTypes() {
	return readFileSync(new URL('../types.d.ts', import.meta.url), 'utf8');
}

describe('ShaderBuilder', () => {
	it('keeps the runtime shader artifact builder skeleton documented', () => {
		const source = readShaderBuilderSource();
		const localTypes = readImplementationTypes();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class ShaderBuilder');
		expect(source).toContain('constructor(dependencies)');
		expect(source).toContain('async build(request)');
		expect(source).toContain('refreshConfig(config)');
		expect(source).toContain('_assembleIfRequested(request, buildContext');
		expect(source).toContain('@param {ShaderBuildRequest} request -');
		expect(source).toContain('@returns {Promise<ShaderBuildResult>} The built runtime shader artifact');
		expect(localTypes).toContain('type ShaderBuilderDependencies');
		expect(localTypes).toContain('type ShaderBuildRequest');
		expect(localTypes).toContain('type ShaderBuildResult');
		expect(localTypes).toContain('readonly assembler?: ShaderAssembler');
		expect(localTypes).toContain('readonly descriptorBuilder?: ShaderDescriptorBuilder');
		expect(localTypes).toContain('readonly transport?: Algorithm32Transport');
		expect(localTypes).toContain('type SceneInputCaptureConfiguration');
		expect(source).toContain("import { SceneInputCapture } from './SceneInputCapture.js';");
	});

	it('builds a setup-time artifact packet from required attachment handles', async () => {
		const model = {
			version: 7,
		};
		const builder = new ShaderBuilder({ model });
		const setup = {
			composer: {},
			scene: {},
			camera: {},
		};

		const result = await builder.build({ setup });

		expect(result).toEqual({
			modelVersion: 7,
			setup,
			diagnostics: {
				status: 'deferred',
			},
		});
	});

	it('fails loudly when setup-time attachment handles are missing', async () => {
		const builder = new ShaderBuilder({
			model: {
				version: 1,
			},
		});

		await expectAsync(builder.build({
			setup: {
				composer: {},
				scene: {},
			},
		})).toBeRejectedWithError(/camera/);
	});

	it('assembles shader source when setup includes descriptor contributions', async () => {
		const builder = new ShaderBuilder({
			model: {
				version: 2,
			},
		});
		const setup = {
			composer: {},
			scene: {},
			camera: {},
		};

		const result = await builder.build({
			setup,
			descriptor: createDescriptor(),
			contributions: [
				createContribution(),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
		});

		expect(result.modelVersion).toBe(2);
		expect(result.diagnostics).toEqual({
			status: 'assembled',
		});
		expect(result.assembly.status).toBe('accepted');
		expect(result.assembly.fragmentShaderSource).toContain('uniform float uRuntimeGain;');
		expect(result.bindingRequirements.map((binding) => binding.id)).toEqual(['uniform.runtime-gain']);
	});

	it('installs and disposes a composer pass when assembly and Three setup are available', async () => {
		const composer = createComposerDouble();
		const builder = new ShaderBuilder({
			model: {
				version: 3,
			},
		});

		const result = await builder.build({
			setup: {
				composer,
				scene: {},
				camera: {},
				THREE: createThreeDouble(),
			},
			descriptor: createDescriptor(),
			contributions: [
				createContribution({
					textures: [
						{
							name: 'uIncidentRadianceTexture',
							type: 'sampler3D',
							valueKey: 'incidentRadianceTexture',
						},
					],
				}),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
			bindingValues: {
				runtimeGain: 4,
			},
			texturePayloads: {
				incidentRadianceTexture: createTexturePayload(),
			},
		});

		expect(result.diagnostics).toEqual({
			status: 'installed',
		});
		expect(composer.passes).toEqual([result.runtime.pass]);
		expect(result.runtime.uniforms.uRuntimeGain.value).toBe(4);
		expect(result.runtime.uniforms.uIncidentRadianceTexture.value).toBe(result.runtime.resources[0].texture);

		result.runtime.dispose();

		expect(composer.passes).toEqual([]);
		expect(result.runtime.pass.enabled).toBe(false);
	});

	it('fails loudly before installing when a required uniform binding is missing', async () => {
		const composer = createComposerDouble();
		const builder = new ShaderBuilder({
			model: {
				version: 4,
			},
		});

		await expectAsync(builder.build({
			setup: {
				composer,
				scene: {},
				camera: {},
				THREE: createThreeDouble(),
			},
			descriptor: createDescriptor(),
			contributions: [
				createContribution(),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
		})).toBeRejectedWithError(/Required shader binding uniform\.runtime-gain \(runtimeGain\) is missing/);
		expect(composer.passes).toEqual([]);
	});

	it('fails loudly before installing when a required texture binding is missing', async () => {
		const composer = createComposerDouble();
		const builder = new ShaderBuilder({
			model: {
				version: 4,
			},
		});

		await expectAsync(builder.build({
			setup: {
				composer,
				scene: {},
				camera: {},
				THREE: createThreeDouble(),
			},
			descriptor: createDescriptor(),
			contributions: [
				createContribution({
					uniforms: [],
					textures: [
						{
							name: 'uMissingTexture',
							type: 'sampler3D',
							valueKey: 'cache.missingTexture',
						},
					],
					bindingRequirements: [
						{
							id: 'cache.missingTexture',
							owner: 'cache',
							kind: 'texture',
							updateFrequency: 'setup',
							valueKey: 'cache.missingTexture',
							required: true,
						},
					],
				}),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
		})).toBeRejectedWithError(/Required shader binding cache\.missingTexture \(cache\.missingTexture\) is missing/);
		expect(composer.passes).toEqual([]);
	});

	it('fails loudly before installing when a cache texture payload does not match descriptor facts', async () => {
		const composer = createComposerDouble();
		const descriptor = createDescriptor();
		descriptor.cache = createSection('cache', {
			cacheKind: 'local',
			payloadKind: 'local-incident-radiance-cache',
			payloadDimensions: [1, 1, 1],
			texture: {
				textureId: 'expected-cache-texture',
				valueKey: 'cache.localIncidentRadianceTexture',
				width: 2,
				height: 1,
				depth: 1,
				dimensionality: '3d',
				format: 'rgba32f',
				samplerPolicy: 'nearest-clamp',
				coordinateOrder: ['x', 'y', 'z'],
				spectralGroupSize: 4,
				spectralGroupCount: 1,
				spectralChannelCount: 3,
			},
		});
		const builder = new ShaderBuilder({
			model: {
				version: 4,
			},
		});

		await expectAsync(builder.build({
			setup: {
				composer,
				scene: {},
				camera: {},
				THREE: createThreeDouble(),
			},
			descriptor,
			contributions: [
				createContribution({
					textures: [
						{
							name: 'uIncidentRadianceCacheTexture',
							type: 'sampler3D',
							valueKey: 'cache.localIncidentRadianceTexture',
						},
					],
					bindingRequirements: [
						{
							id: 'cache.localIncidentRadianceTexture',
							owner: 'cache',
							kind: 'texture',
							updateFrequency: 'setup',
							valueKey: 'cache.localIncidentRadianceTexture',
							required: true,
						},
					],
				}),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
			bindingValues: {
				runtimeGain: 4,
			},
			texturePayloads: {
				'cache.localIncidentRadianceTexture': createTexturePayload('local-incident-radiance-cache'),
			},
		})).toBeRejectedWithError(/textureId test-cache-texture does not match descriptor expected-cache-texture/);
		expect(composer.passes).toEqual([]);
	});

	it('uses owner-provided uniform defaults when setup omits a binding value', async () => {
		const composer = createComposerDouble();
		const builder = new ShaderBuilder({
			model: {
				version: 4,
			},
		});

		const result = await builder.build({
			setup: {
				composer,
				scene: {},
				camera: {},
				THREE: createThreeDouble(),
			},
			descriptor: createDescriptor(),
			contributions: [
				createContribution({
					uniforms: [
						{
							name: 'uRuntimeGain',
							type: 'float',
							valueKey: 'runtimeGain',
							defaultValue: 7,
						},
					],
				}),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
		});

		expect(result.runtime.uniforms.uRuntimeGain.value).toBe(7);

		result.runtime.dispose();
	});

	it('binds geometry-resolved scene-depth cap without creating capture when no capture textures are required', async () => {
		const composer = createComposerDouble();
		const geometry = {
			resolveSceneDepthMaxMeters: jasmine.createSpy('resolveSceneDepthMaxMeters')
				.and.returnValue(456),
		};
		const builder = new ShaderBuilder({
			model: {
				version: 5,
				geometry,
			},
		});

		const result = await builder.build({
			setup: {
				composer,
				scene: {},
				camera: {
					position: {
						x: 1,
						y: 2,
						z: 3,
					},
				},
				THREE: createThreeDouble(),
				metersPerSceneUnit: 1000,
			},
			descriptor: createDescriptor(),
			contributions: [
				createContribution({
					uniforms: [
						{
							name: 'uSceneDepthMaxMeters',
							type: 'float',
							valueKey: 'geometry.sceneDepthMaxMeters',
						},
					],
				}),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
			bindingValues: {
				runtimeGain: 4,
			},
		});

		expect(result.runtime.sceneInputCapture).toBeNull();
		expect(composer.passes).toEqual([result.runtime.pass]);
		expect(geometry.resolveSceneDepthMaxMeters).toHaveBeenCalledWith(jasmine.objectContaining({
			cameraPositionSceneUnits: [1, 2, 3],
			metersPerSceneUnit: 1000,
			distanceMultiplier: 1000,
		}));
		expect(result.runtime.uniforms.uSceneDepthMaxMeters.value).toBe(456);

		result.runtime.dispose();
	});

	it('builds the descriptor from the shared model when contributions do not provide one', async () => {
		const model = {
			version: 9,
			snapshot() {
				return createSharedModelSnapshot();
			},
		};
		const color = createColorDouble();
		const expectedDescriptor = new ShaderDescriptorBuilder().build({
			model,
			config: {
				config: {
					color,
					shader: {
						mode: 'descriptor-test',
					},
				},
			},
		});
		const builder = new ShaderBuilder({ model });

		const result = await builder.build({
			setup: {
				composer: {},
				scene: {},
				camera: {},
			},
			config: {
				config: {
					color,
					shader: {
						mode: 'descriptor-test',
					},
				},
			},
			contributions: [
				createContribution({
					descriptorFingerprint: expectedDescriptor.runtime.fingerprint,
					provides: ['runtime.initialState', 'createInitialShaderState'],
				}),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
		});

		expect(result.assembly.descriptor.fingerprint).toBe(expectedDescriptor.fingerprint);
		expect(result.assembly.descriptor.runtime.facts.mode).toBe('descriptor-test');
	});

	it('collects optional owner-provided shader contributions from configured models', async () => {
		let receivedProviderRequest;
		const model = {
			version: 10,
			geometry: {
				createShaderContribution(request) {
					receivedProviderRequest = request;

					return createContribution({
						id: 'geometry-state',
						owner: 'geometry',
						descriptorFingerprint: request.descriptor.geometry.fingerprint,
						provides: [],
						uniforms: [],
						bindingRequirements: [],
					});
				},
			},
			snapshot() {
				return {
					...createSharedModelSnapshot(),
					version: 10,
				};
			},
		};
		const builder = new ShaderBuilder({ model });

		const result = await builder.build({
			setup: {
				composer: {},
				scene: {},
				camera: {},
			},
			config: {
				config: {
					color: createColorDouble(),
				},
			},
			mainRequiredSymbols: ['createInitialShaderState'],
		});

		expect(receivedProviderRequest.model).toBe(model);
		expect(receivedProviderRequest.descriptor.geometry.facts.id).toBe('geometry-test');
		expect(result.assembly.contributions.map((contribution) => contribution.id)).toContain('geometry-state');
		expect(result.assembly.validationReport.status).toBe('accepted');
	});

	it('adds the shared runtime contribution when owner contributions require runtime initial state', async () => {
		const model = {
			version: 11,
			geometry: {
				createShaderContribution(request) {
					return {
						id: 'geometry-ray',
						owner: 'geometry',
						descriptorFingerprint: request.descriptor.geometry.fingerprint,
						compatibilityTags: [],
						provides: ['geometry.reconstructViewRay'],
						requires: ['runtime.initialState'],
						defines: [],
						uniforms: [],
						textures: [],
						functions: [],
						mainHooks: [],
						bindingRequirements: [],
					};
				},
			},
			snapshot() {
				return {
					...createSharedModelSnapshot(),
					version: 11,
				};
			},
		};
		const builder = new ShaderBuilder({ model });

		const result = await builder.build({
			setup: {
				composer: {},
				scene: {},
				camera: {},
			},
			config: {
				config: {
					color: createColorDouble(),
				},
			},
			mainRequiredSymbols: ['runtime.initialState', 'geometry.reconstructViewRay'],
		});

		expect(result.assembly.contributions.map((contribution) => contribution.id)).toContain('runtime-three-single-camera');
		expect(result.assembly.validationReport.providedSymbols).toContain('runtime.initialState');
		expect(result.assembly.fragmentShaderSource).toContain('ShaderState createInitialShaderState(vec2 uv)');
		expect(result.assembly.fragmentShaderSource).toContain('texelFetch(uSceneDepthTexture, sceneInputPixel, 0)');
		expect(result.assembly.fragmentShaderSource).toContain('texelFetch(uSceneHitTexture, sceneInputPixel, 0)');
		expect(result.assembly.fragmentShaderSource).toContain('texelFetch(uSceneColorTexture, sceneInputPixel, 0)');
	});

	it('fails loudly when encoded color is required without configured Color', async () => {
		const model = {
			version: 12,
			snapshot() {
				return {
					...createSharedModelSnapshot(),
					version: 12,
				};
			},
		};
		const builder = new ShaderBuilder({ model });

		await expectAsync(builder.build({
			setup: {
				composer: {},
				scene: {},
				camera: {},
			},
			mainRequiredSymbols: ['runtime.initialState', 'color.encodeOutput'],
		})).toBeRejectedWithError(/Color abstraction/);
	});

	it('collects Color shader contributions from the accepted facade config', async () => {
		let receivedProviderRequest;
		const color = {
			describe() {
				return {
					kind: 'algorithm32-color',
					id: 'configured-color',
					colorSpace: 'linear-display',
					fingerprint: 'color:configured',
				};
			},
			convert() {
				return { rgba: [1, 1, 1, 1] };
			},
			createShaderContribution(request) {
				receivedProviderRequest = request;

				return {
					id: 'color-configured-output',
					owner: 'color',
					descriptorFingerprint: request.descriptor.color.fingerprint,
					compatibilityTags: request.descriptor.color.compatibilityTags,
					provides: ['color.encodeOutput'],
					requires: ['runtime.initialState'],
					defines: [],
					uniforms: [],
					textures: [],
					functions: [],
					mainHooks: [
						{
							id: 'configured-color-output',
							slot: 'encodeOutput',
							order: 0,
							code: 'outColor = vec4(1.0);',
						},
					],
					bindingRequirements: [],
				};
			},
		};
		const model = {
			version: 13,
			snapshot() {
				return {
					...createSharedModelSnapshot(),
					version: 13,
				};
			},
		};
		const builder = new ShaderBuilder({ model });

		const result = await builder.build({
			setup: {
				composer: {},
				scene: {},
				camera: {},
			},
			config: {
				config: {
					color,
				},
			},
			mainRequiredSymbols: ['runtime.initialState', 'color.encodeOutput'],
		});

		expect(receivedProviderRequest.config.config.color).toBe(color);
		expect(receivedProviderRequest.descriptor.color.facts.id).toBe('configured-color');
		expect(result.assembly.contributions.map((contribution) => contribution.id)).toContain('color-configured-output');
		expect(result.assembly.fragmentShaderSource).toContain('outColor = vec4(1.0);');
	});

	it('builds source-created cache payloads for automatic configured-model shader setup', async () => {
		const composer = createComposerDouble();
		const cache = createShaderCacheDouble();
		const model = createAutomaticShaderModel(cache);
		const builder = new ShaderBuilder({
			model,
			transport: createTransportDouble(),
		});

		const result = await builder.build({
			setup: {
				composer,
				scene: {},
				camera: {},
				THREE: createThreeDouble(),
			},
			config: {
				config: {
					color: createColorDouble(),
					execution: {
						pathIntervalCount: 2,
					},
				},
			},
		});

		expect(model.lightSource.createIncidentRadianceCache).toHaveBeenCalledWith(jasmine.objectContaining({
			geometry: model.geometry,
			atmosphere: model.atmosphere,
			lightSource: model.lightSource,
			spectralBasis: model.spectral.basis,
			bottomRadiusMeters: 10,
			topRadiusMeters: 20,
		}));
		expect(cache.addCoordinateToCache).toHaveBeenCalledWith(jasmine.objectContaining({
			coordinate: jasmine.objectContaining({ coordinateKey: 'cache-coordinate' }),
			geometry: model.geometry,
			atmosphere: model.atmosphere,
			lightSource: model.lightSource,
			pathIntervalCount: 2,
		}));
		expect(result.cacheBuild.cache).toBe(cache);
		expect(result.cacheBuild.coordinateCount).toBe(1);
		expect(result.assembly.descriptor.cache.facts).toEqual(cache.descriptor);
		expect(result.assembly.contributions.map((contribution) => contribution.id)).toEqual(jasmine.arrayContaining([
			'cache-owner-test',
			'transport-core-test',
		]));
		expect(result.runtime.resources[0].valueKey).toBe('cache.localIncidentRadianceTexture');
		expect(result.runtime.uniforms.uIncidentRadianceCacheTexture.value).toBe(result.runtime.resources[0].texture);
		expect(result.runtime.sceneInputCapture).not.toBeNull();
		expect(composer.passes).toEqual([result.runtime.sceneInputCapture, result.runtime.pass]);
		expect(result.runtime.uniforms.uSceneDepthTexture.value).toBe(result.runtime.sceneInputCapture.depthTexture);
		expect(result.runtime.uniforms.uSceneHitTexture.value).toBe(result.runtime.sceneInputCapture.hitTexture);
		expect(result.runtime.uniforms.uViewportPixels.value.x).toBe(1);
		expect(result.runtime.uniforms.uViewportPixels.value.y).toBe(1);
		expect(model.geometry.resolveSceneDepthMaxMeters).toHaveBeenCalledWith(jasmine.objectContaining({
			metersPerSceneUnit: 1,
			distanceMultiplier: 1,
		}));
		expect(result.runtime.sceneInputCapture.getDiagnostics().sceneDepthMaxMeters).toBe(321);
		expect(result.runtime.uniforms.uSceneDepthMaxMeters.value).toBe(321);

		result.runtime.dispose();
		expect(composer.passes).toEqual([]);
		expect(result.runtime.sceneInputCapture.getDiagnostics().status).toBe('disposed');
	});

	it('fails loudly after disposal', async () => {
		const builder = new ShaderBuilder({
			model: {
				version: 1,
			},
		});

		builder.dispose();

		await expectAsync(builder.build({
			setup: {
				composer: {},
				scene: {},
				camera: {},
			},
		})).toBeRejectedWithError(/disposed/);
	});
});

/**
 * Create a complete descriptor for ShaderBuilder assembly specs.
 *
 * @returns {Algorithm32ShaderDescriptor} Return descriptor.
 */
function createDescriptor() {
	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis'),
		geometry: createSection('geometry'),
		atmosphere: createSection('atmosphere'),
		lightSource: createSection('light-source'),
		cache: createSection('cache'),
		transport: createSection('transport'),
		color: createSection('color'),
		runtime: createSection('runtime'),
	};
}

/**
 * Create a model snapshot for descriptor-builder integration specs.
 *
 * @returns {SharedModelSnapshot} Return snapshot.
 */
function createSharedModelSnapshot() {
	return {
		version: 9,
		lightSource: {
			kind: 'algorithm32-light-source-model',
			id: 'light-source-test',
			fingerprint: 'light-source:fingerprint',
		},
		atmosphere: {
			kind: 'algorithm32-atmosphere-model',
			id: 'atmosphere-test',
			fingerprint: 'atmosphere:fingerprint',
		},
		geometry: {
			kind: 'algorithm32-geometry-model',
			id: 'geometry-test',
			fingerprint: 'geometry:fingerprint',
		},
		spectral: {
			kind: 'algorithm32-spectral-model',
			wavelengths: [
				{
					value: 550,
					units: 'nanometers',
				},
			],
			channelCount: 1,
			fingerprint: 'spectral:fingerprint',
			version: 9,
		},
	};
}

function createAutomaticShaderModel(cache) {
	const snapshot = {
		...createSharedModelSnapshot(),
		geometry: {
			kind: 'flat-earth-geometry',
			id: 'geometry-test',
			bottomRadiusMeters: 10,
			topRadiusMeters: 20,
			cacheBoundaryAltitudeMeters: 2,
			fingerprint: 'geometry:fingerprint',
		},
	};

	return {
		version: 14,
		geometry: {
			resolveSceneDepthMaxMeters: jasmine.createSpy('resolveSceneDepthMaxMeters')
				.and.returnValue(321),
			createShaderContribution(request) {
				return createContribution({
					id: 'geometry-owner-test',
					owner: 'geometry',
					descriptorFingerprint: request.descriptor.geometry.fingerprint,
					provides: ['geometry.test'],
					uniforms: [
						{
							name: 'uSceneDepthMaxMeters',
							type: 'float',
							valueKey: 'geometry.sceneDepthMaxMeters',
						},
					],
					functions: [],
					bindingRequirements: [],
				});
			},
		},
		atmosphere: {
			createShaderContribution(request) {
				return createContribution({
					id: 'atmosphere-owner-test',
					owner: 'atmosphere',
					descriptorFingerprint: request.descriptor.atmosphere.fingerprint,
					provides: ['atmosphere.test'],
					uniforms: [],
					functions: [],
					bindingRequirements: [],
				});
			},
		},
		lightSource: {
			createIncidentRadianceCache: jasmine.createSpy('createIncidentRadianceCache')
				.and.returnValue(cache),
			createShaderContribution(request) {
				return createContribution({
					id: 'light-owner-test',
					owner: 'lightSource',
					descriptorFingerprint: request.descriptor.lightSource.fingerprint,
					provides: ['light.test'],
					uniforms: [],
					functions: [],
					bindingRequirements: [],
				});
			},
		},
		spectral: {
			basis: createSpectralBasis(),
		},
		snapshot() {
			return snapshot;
		},
	};
}

function createShaderCacheDouble() {
	const cache = {
		descriptor: {
			cacheKind: 'local',
			sourceKey: 'light-source-test',
			version: 1,
			payloadKind: 'local-incident-radiance-cache',
			payloadDimensions: [1, 1, 1],
			texture: {
				kind: 'rgba32f-3d-texture-v1',
				textureId: 'test-cache-texture',
				valueKey: 'cache.localIncidentRadianceTexture',
				width: 1,
				height: 1,
				depth: 1,
				dimensionality: '3d',
				format: 'rgba32f',
				samplerPolicy: 'nearest-clamp',
				coordinateOrder: ['x', 'y', 'z'],
				spectralGroupSize: 4,
				spectralGroupCount: 1,
				spectralChannelCount: 3,
			},
		},
		coordinates: function* coordinates() {
			yield {
				coordinateKey: 'cache-coordinate',
				coordinates: [0, 0],
			};
		},
		addCoordinateToCache: jasmine.createSpy('addCoordinateToCache'),
		createIncidentRadianceSampler() {
			return () => [];
		},
		createShaderPayload() {
			return createTexturePayload('local-incident-radiance-cache');
		},
		createShaderContribution(request) {
			return createContribution({
				id: 'cache-owner-test',
				owner: 'cache',
				descriptorFingerprint: request.descriptor.cache.fingerprint,
				provides: ['cache.lookupIncidentRadiance'],
				uniforms: [],
				textures: [
					{
						name: 'uIncidentRadianceCacheTexture',
						type: 'sampler3D',
						valueKey: 'cache.localIncidentRadianceTexture',
					},
				],
				functions: [],
				bindingRequirements: [
					{
						id: 'cache.localIncidentRadianceTexture',
						owner: 'cache',
						kind: 'texture',
						updateFrequency: 'setup',
						valueKey: 'cache.localIncidentRadianceTexture',
						required: true,
					},
				],
			});
		},
	};

	return cache;
}

function createTransportDouble() {
	return {
		mainRequiredShaderSymbols() {
			return [
				'runtime.initialState',
				'cache.lookupIncidentRadiance',
				'transport.evaluatePathRadiance',
				'color.encodeOutput',
			];
		},
		createShaderContribution(request) {
			return createContribution({
				id: 'transport-core-test',
				owner: 'transport',
				descriptorFingerprint: request.descriptor.transport.fingerprint,
				provides: ['transport.evaluatePathRadiance'],
				requires: ['cache.lookupIncidentRadiance'],
				uniforms: [],
				functions: [],
				bindingRequirements: [],
			});
		},
	};
}

function createColorDouble() {
	return {
		describe() {
			return {
				kind: 'algorithm32-color',
				id: 'configured-color',
				colorSpace: 'linear-display',
				fingerprint: 'color:configured',
			};
		},
		createShaderContribution(request) {
			return createContribution({
				id: 'color-configured-output',
				owner: 'color',
				descriptorFingerprint: request.descriptor.color.fingerprint,
				provides: [
					'color.composeSceneColor',
					'color.encodeOutput',
				],
				requires: ['runtime.initialState'],
				uniforms: [],
				functions: [],
				mainHooks: [
					{
						id: 'color-compose-test',
						slot: 'composeSceneColor',
						order: 0,
						code: 'state.outputRgba = vec4(1.0);',
					},
					{
						id: 'color-encode-test',
						slot: 'encodeOutput',
						order: 0,
						code: 'outColor = state.outputRgba;',
					},
				],
				bindingRequirements: [],
			});
		},
	};
}

function createSpectralBasis() {
	return {
		wavelengths: [
			{
				value: 550,
				units: 'nanometers',
			},
		],
	};
}

/**
 * Create a small cache texture payload for ShaderBuilder resource binding.
 *
 * @param {string} [payloadKind] - Supplies the payload kind.
 * @returns {CacheShaderPayloadDescriptor} Return payload descriptor.
 */
function createTexturePayload(payloadKind = 'test-cache') {
	return {
		payloadKind,
		dimensions: [1, 1, 1],
		format: 'float32-spectral',
		texture: {
			kind: 'rgba32f-3d-texture-v1',
			textureId: 'test-cache-texture',
			width: 1,
			height: 1,
			depth: 1,
			dimensionality: '3d',
			format: 'rgba32f',
			samplerPolicy: 'nearest-clamp',
			coordinateOrder: ['x', 'y', 'z'],
			spectralGroupSize: 4,
			spectralGroupCount: 1,
			spectralChannelCount: 3,
			rgbaFloat32: [1, 2, 3, 0],
		},
	};
}

/**
 * Create one descriptor section.
 *
 * @param {string} fingerprint - Store the section fingerprint.
 * @param {unknown} [facts] - Store section-owned facts.
 * @returns {ShaderDescriptorSection} Return section.
 */
function createSection(fingerprint, facts = {}) {
	return {
		descriptorId: fingerprint,
		fingerprint,
		compatibilityTags: [],
		facts,
	};
}

/**
 * Create one shader contribution.
 *
 * @returns {ShaderContribution} Return contribution.
 */
function createContribution(overrides = {}) {
	return {
		id: 'runtime-state',
		owner: 'runtime',
		descriptorFingerprint: 'runtime',
		compatibilityTags: [],
		provides: ['createInitialShaderState'],
		requires: [],
		defines: [],
		uniforms: [
			{
				name: 'uRuntimeGain',
				type: 'float',
				valueKey: 'runtimeGain',
			},
		],
		textures: [],
		functions: [
			{
				id: 'state-type',
				slot: 'declareTypes',
				order: 0,
				code: 'struct ShaderState { vec2 uv; vec3 color; };',
			},
			{
				id: 'create-state',
				slot: 'declareHelpers',
				order: 0,
				code: 'ShaderState createInitialShaderState(vec2 uv) { return ShaderState(uv, vec3(0.0)); }',
			},
		],
		mainHooks: [],
		bindingRequirements: [
			{
				id: 'uniform.runtime-gain',
				owner: 'runtime',
				kind: 'uniform',
				updateFrequency: 'config',
				valueKey: 'runtimeGain',
				required: true,
			},
		],
		...overrides,
	};
}

/**
 * Create a fake composer with add/remove pass support.
 *
 * @returns {object} Return fake composer.
 */
function createComposerDouble() {
	return {
		passes: [],
		addPass(pass) {
			this.passes.push(pass);
		},
		removePass(pass) {
			const index = this.passes.indexOf(pass);

			if (index !== -1) {
				this.passes.splice(index, 1);
			}
		},
	};
}

/**
 * Create a fake Three namespace.
 *
 * @returns {object} Return fake Three constructors.
 */
function createThreeDouble() {
	return {
		GLSL3: 'GLSL3',
		RGBAFormat: 'RGBAFormat',
		UnsignedByteType: 'UnsignedByteType',
		FloatType: 'FloatType',
		NearestFilter: 'NearestFilter',
		LinearFilter: 'LinearFilter',
		ClampToEdgeWrapping: 'ClampToEdgeWrapping',
		Color: class Color {},
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
		Data3DTexture: class Data3DTexture {
			constructor(data, width, height, depth) {
				this.image = {
					data,
					width,
					height,
					depth,
				};
				this.disposed = false;
			}

			dispose() {
				this.disposed = true;
			}
		},
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
		ShaderMaterial: class ShaderMaterial {
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
