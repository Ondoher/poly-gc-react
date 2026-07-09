import { fibonacciSphereDirection } from './IncidentRadianceDirections.js';
import TextureBuilder from '../shader/TextureBuilder.js';
import { RUNTIME_NUMERICAL_CONTROLS } from '../constants/Algorithm32CanonicalData.js';

const SPECTRAL_GROUP_SIZE = 4;
const DEFAULT_SPECTRAL_GROUP_COUNT = 4;

/**
 * Own a local-sun incident-radiance cache and its CPU/GPU payloads.
 */
export class LocalSunIncidentRadianceCache {
	/**
	 * Create a local-sun incident-radiance cache.
	 *
	 * @param {LocalIncidentRadianceCacheConfig} configuration - Supplies cache
	 * descriptor, z/rho bins, direction count, and spectral basis.
	 */
	constructor(configuration) {
		if (!configuration || typeof configuration !== 'object') {
			throw new TypeError('LocalSunIncidentRadianceCache configuration is required.');
		}

		const {
			sourceKey,
			zBinsMeters,
			rhoBinsMeters,
			directionCount,
			spectralBasis,
		} = configuration;

		if (!sourceKey || typeof sourceKey !== 'string' || !isFiniteNumberArray(zBinsMeters) || !isFiniteNumberArray(rhoBinsMeters)) {
			throw new TypeError('Local cache requires sourceKey and finite z/rho bins.');
		}

		if (!Number.isInteger(directionCount) || directionCount < 1) {
			throw new RangeError('Local cache directionCount must be a positive integer.');
		}

		assertSpectralBasis(spectralBasis);

		this._configuration = Object.freeze({
			sourceKey,
			zBinsMeters: Object.freeze([...zBinsMeters]),
			rhoBinsMeters: Object.freeze([...rhoBinsMeters]),
			directionCount,
			spectralBasis,
			runtimeDiagnosticLimit: 50,
		});
		this._valuesByKey = new Map();
		this._runtimeDiagnostics = [];
	}

	/**
	 * Return the cache-owned descriptor for the current generated layout.
	 *
	 * @returns {IncidentRadianceCacheDescriptor} The cache descriptor.
	 */
	get descriptor() {
		return createLocalCacheDescriptor(this._configuration, this._valuesByKey.size);
	}

	/**
	 * Return the generated value count.
	 *
	 * @returns {number} The number of stored cache values.
	 */
	get valueCount() {
		return this._valuesByKey.size;
	}

	/**
	 * Return runtime diagnostics recorded by tolerant sampler paths.
	 *
	 * @returns {readonly unknown[]} Runtime diagnostic records.
	 */
	get runtimeDiagnostics() {
		return Object.freeze([...this._runtimeDiagnostics]);
	}

	/**
	 * Return cache-owned build coordinates.
	 *
	 * @returns {Iterable<CacheBuildCoordinate>} Cache-owned build coordinates.
	 */
	*coordinates() {
		for (let zBinIndex = 0; zBinIndex < this._configuration.zBinsMeters.length; zBinIndex += 1) {
			const altitudeMeters = this._configuration.zBinsMeters[zBinIndex];

			for (let rhoBinIndex = 0; rhoBinIndex < this._configuration.rhoBinsMeters.length; rhoBinIndex += 1) {
				const rhoMeters = this._configuration.rhoBinsMeters[rhoBinIndex];

				for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
					yield Object.freeze({
						coordinateKey: this._key(zBinIndex, rhoBinIndex, directionIndex),
						coordinates: Object.freeze([zBinIndex, rhoBinIndex, directionIndex]),
						zBinIndex,
						rhoBinIndex,
						directionIndex,
						altitudeMeters,
						rhoMeters,
						incomingDirection: fibonacciSphereDirection(directionIndex, this._configuration.directionCount),
						metadata: Object.freeze({
							angularWeight: (4 * Math.PI) / this._configuration.directionCount,
							coordinateSystem: 'local-source-z-rho',
						}),
					});
				}
			}
		}
	}

	/**
	 * Generate and store the value for one cache-owned coordinate.
	 *
	 * @param {CacheCoordinateBuildRequest} request - Supplies the coordinate,
	 * geometry, calculator, and optional execution policy.
	 * @returns {void}
	 */
	addCoordinateToCache(request) {
		const { coordinate, geometry, calculator, pathIntervalCount } = request ?? {};

		if (!coordinate || !geometry || !calculator) {
			throw new TypeError('Local cache coordinate build requires coordinate, geometry, and calculator.');
		}

		if (typeof geometry.resolveCacheBuildRay !== 'function') {
			throw new TypeError('Local cache coordinate build requires geometry.resolveCacheBuildRay.');
		}

		const key = this._key(coordinate.zBinIndex, coordinate.rhoBinIndex, coordinate.directionIndex);
		const raySegment = geometry.resolveCacheBuildRay(coordinate);

		if (raySegment == null) {
			this._valuesByKey.set(key, this._zero());
			return;
		}

		const intervalCount = pathIntervalCount ?? 1;
		const points = calculator.buildEndpointTrapezoidPathIntegrationPoints(raySegment, intervalCount);
		const pathRadiance = calculator.computeRadiance(raySegment, points);

		this._valuesByKey.set(key, Object.freeze([...pathRadiance.inScattered]));
	}

	/**
	 * Create a runtime incident-radiance sampler over the generated values.
	 *
	 * @returns {IncidentRadianceSampler} Runtime incident-radiance sampler.
	 */
	createIncidentRadianceSampler() {
		return (cacheAccess) => {
			const zBinIndex = cacheAccess?.coordinates?.[0];
			const rhoBinIndex = cacheAccess?.coordinates?.[1];

			if (!Number.isInteger(zBinIndex) || !Number.isInteger(rhoBinIndex)) {
				this._diagnose('local-cache-invalid-access', 'error',
					'Local cache access requires z and rho bin coordinates.', { cacheAccess });

				return Object.freeze([]);
			}

			const samples = [];
			const weight = (4 * Math.PI) / this._configuration.directionCount;

			for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
				const key = this._key(zBinIndex, rhoBinIndex, directionIndex);
				const radiance = this._valuesByKey.get(key);

				if (!radiance) {
					this._diagnose('local-cache-missing-value', 'error',
						'Local cache missing value at runtime; returning safe empty contribution.', {
							key,
							cacheAccess,
						});

					return Object.freeze([]);
				}

				samples.push(Object.freeze({
					incomingDirection: fibonacciSphereDirection(directionIndex, this._configuration.directionCount),
					radiance,
					weight,
				}));
			}

			return Object.freeze(samples);
		};
	}

	/**
	 * Create a shader-facing cache payload descriptor.
	 *
	 * @returns {CacheShaderPayloadDescriptor} The payload descriptor.
	 */
	createShaderPayload() {
		const spectralChannelCount = getSpectralChannelCount(this._configuration.spectralBasis);
		const spectralGroupCount = Math.ceil(spectralChannelCount / SPECTRAL_GROUP_SIZE);
		const zBinCount = this._configuration.zBinsMeters.length;
		const rhoBinCount = this._configuration.rhoBinsMeters.length;
		const rgbaFloat32 = [];

		for (let zBinIndex = 0; zBinIndex < zBinCount; zBinIndex += 1) {
			for (let spectralGroupIndex = 0; spectralGroupIndex < spectralGroupCount; spectralGroupIndex += 1) {
				for (let rhoBinIndex = 0; rhoBinIndex < rhoBinCount; rhoBinIndex += 1) {
					for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
						const key = this._key(zBinIndex, rhoBinIndex, directionIndex);
						const radiance = this._valuesByKey.get(key);

						if (!radiance) {
							throw new Error(`Local incident radiance cache is missing ${key}.`);
						}

						for (let componentIndex = 0; componentIndex < SPECTRAL_GROUP_SIZE; componentIndex += 1) {
							const channelIndex = spectralGroupIndex * SPECTRAL_GROUP_SIZE + componentIndex;
							rgbaFloat32.push(channelIndex < spectralChannelCount ? radiance[channelIndex] : 0);
						}
					}
				}
			}
		}

		const descriptor = this.descriptor;
		const textureFacts = descriptor.texture;

		return Object.freeze({
			payloadKind: descriptor.payloadKind,
			dimensions: descriptor.payloadDimensions,
			format: 'float32-spectral',
			texture: Object.freeze({
				kind: textureFacts.kind,
				textureId: textureFacts.textureId,
				width: textureFacts.width,
				height: textureFacts.height,
				depth: textureFacts.depth,
				dimensionality: textureFacts.dimensionality,
				format: textureFacts.format,
				samplerPolicy: textureFacts.samplerPolicy,
				coordinateOrder: textureFacts.coordinateOrder,
				spectralGroupSize: textureFacts.spectralGroupSize,
				spectralGroupCount: textureFacts.spectralGroupCount,
				spectralChannelCount: textureFacts.spectralChannelCount,
				rgbaFloat32: Object.freeze(rgbaFloat32),
			}),
			lookup: descriptor.lookup,
			metadata: descriptor.metadata,
		});
	}

	/**
	 * Create the cache-owned local incident-radiance shader contribution.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active shader descriptor.
	 * @returns {ShaderContribution} The cache shader contribution.
	 */
	createShaderContribution(request) {
		return this._createShaderContribution(request?.descriptor);
	}

	/**
	 * Create the cache-owned local incident-radiance shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @param {TextureBuilder} [textureBuilder] - Supplies the texture descriptor builder.
	 * @returns {ShaderContribution} Return the cache contribution.
	 */
	_createShaderContribution(descriptor, textureBuilder = new TextureBuilder()) {
		assertCacheDescriptor(descriptor);
		const cacheFacts = resolveLocalCacheFacts(descriptor);
		const cacheTexture = textureBuilder.createTexture({
			textureId: cacheFacts.textureId,
			owner: 'cache',
			dimensionality: '3d',
			dimensions: Object.freeze([
				cacheFacts.textureWidth,
				cacheFacts.textureHeight,
				cacheFacts.textureDepth,
			]),
			formatPreference: Object.freeze(['float32', 'half-float']),
			samplerPolicy: cacheFacts.samplerPolicy,
			valueKey: cacheFacts.valueKey,
			accessFunctionName: 'readLocalIncidentRadianceTexture',
		});

		return createLocalCacheShaderContribution(descriptor, cacheTexture, cacheFacts);
	}

	_key(zBinIndex, rhoBinIndex, directionIndex) {
		if (
			!Number.isInteger(zBinIndex)
			|| !Number.isInteger(rhoBinIndex)
			|| !Number.isInteger(directionIndex)
		) {
			throw new TypeError('Local cache coordinate indices must be integers.');
		}

		return `${zBinIndex}:${rhoBinIndex}:${directionIndex}`;
	}

	_zero() {
		return Object.freeze(Array.from({ length: getSpectralChannelCount(this._configuration.spectralBasis) }, () => 0));
	}

	_diagnose(id, severity, message, details) {
		if (this._runtimeDiagnostics.length >= this._configuration.runtimeDiagnosticLimit) {
			return;
		}

		this._runtimeDiagnostics.push(Object.freeze({
			id,
			severity,
			message,
			details: Object.freeze({ ...details }),
		}));
	}
}

/**
 * Check for a finite numeric array.
 *
 * @param {unknown} values - Supplies the candidate values.
 * @returns {boolean} True when all values are finite numbers.
 */
function isFiniteNumberArray(values) {
	return Array.isArray(values) && values.length > 0 && values.every(Number.isFinite);
}

/**
 * Return the spectral channel count from a production spectral basis.
 *
 * @param {SpectralBasis} spectralBasis - Supplies the spectral basis.
 * @returns {number} The channel count.
 */
function getSpectralChannelCount(spectralBasis) {
	if (Array.isArray(spectralBasis?.wavelengths)) {
		return spectralBasis.wavelengths.length;
	}

	throw new TypeError('Spectral basis must provide wavelength samples.');
}

/**
 * Assert that the spectral basis has at least one channel.
 *
 * @param {unknown} spectralBasis - Supplies the candidate spectral basis.
 * @returns {void}
 */
function assertSpectralBasis(spectralBasis) {
	if (getSpectralChannelCount(spectralBasis) < 1) {
		throw new TypeError('Spectral basis must provide at least one wavelength sample.');
	}
}

/**
 * Create the cache-owned descriptor from the active local cache layout.
 *
 * @param {object} configuration - Supplies the cache configuration.
 * @param {number} valueCount - Supplies the generated coordinate count.
 * @returns {IncidentRadianceCacheDescriptor} The cache descriptor.
 */
function createLocalCacheDescriptor(configuration, valueCount) {
	const spectralChannelCount = getSpectralChannelCount(configuration.spectralBasis);
	const spectralGroupCount = Math.ceil(spectralChannelCount / SPECTRAL_GROUP_SIZE);
	const zBinCount = configuration.zBinsMeters.length;
	const rhoBinCount = configuration.rhoBinsMeters.length;
	const uploadValueCount = configuration.directionCount
		* rhoBinCount
		* zBinCount
		* spectralGroupCount
		* 4;

	return Object.freeze({
		cacheKind: 'local',
		sourceKey: configuration.sourceKey,
		version: 1,
		payloadKind: 'local-incident-radiance-cache',
		dimensions: Object.freeze(['z', 'rho', 'incomingDirection', 'wavelength']),
		payloadDimensions: Object.freeze([
			zBinCount,
			rhoBinCount,
			configuration.directionCount,
			spectralChannelCount,
		]),
		texture: Object.freeze({
			kind: 'rgba32f-3d-texture-v1',
			textureId: 'incident-radiance-local-l2',
			valueKey: 'cache.localIncidentRadianceTexture',
			width: configuration.directionCount,
			height: rhoBinCount,
			depth: zBinCount * spectralGroupCount,
			dimensionality: '3d',
			format: 'rgba32f',
			samplerPolicy: 'nearest-clamp',
			coordinateOrder: Object.freeze(['directionIndex', 'rhoBinIndex', 'zSpectralGroupIndex']),
			spectralGroupSize: SPECTRAL_GROUP_SIZE,
			spectralGroupCount,
			spectralChannelCount,
		}),
		lookup: Object.freeze({
			policy: 'z-rho-bin-all-directions',
			directionSequence: 'fibonacci-sphere',
			directionWeight: (4 * Math.PI) / configuration.directionCount,
			zBinsMeters: configuration.zBinsMeters,
			rhoBinsMeters: configuration.rhoBinsMeters,
			depthPacking: 'z-bin-major-spectral-group-minor',
		}),
		metadata: Object.freeze({
			zBinCount,
			rhoBinCount,
			directionCount: configuration.directionCount,
			lookupPolicy: 'nearest-neighbor-poc-grid',
			valueCount,
			uploadValueCount,
		}),
	});
}

/**
 * Create the local incident-cache shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @param {ShaderTextureBuildResult} cacheTexture - Supplies texture descriptor.
 * @param {object} facts - Supplies normalized cache facts.
 * @returns {ShaderContribution} Return the cache contribution.
 */
function createLocalCacheShaderContribution(descriptor, cacheTexture, facts) {
	return shaderContribution({
		id: 'cache-local-l2-incident-radiance',
		owner: 'cache',
		descriptorFingerprint: descriptor.cache.fingerprint,
		compatibilityTags: descriptor.cache.compatibilityTags,
		provides: Object.freeze(['cache.lookupIncidentRadiance']),
		requires: Object.freeze(['geometry.cacheAccessCoordinate']),
		textures: Object.freeze([
			shaderTexture('uIncidentRadianceCacheTexture', 'sampler3D', cacheTexture.valueKey),
		]),
		bindingRequirements: Object.freeze([
			shaderBinding('cache.localIncidentRadianceTexture', 'cache', 'texture', 'setup', cacheTexture.valueKey, true),
		]),
		functions: Object.freeze([
			shaderBlock('cache-constants', 'declareConstants', 0, `const int LOCAL_CACHE_DIRECTION_COUNT = ${facts.directionCount};
const int LOCAL_CACHE_RHO_BIN_COUNT = ${facts.rhoBinCount};
const int LOCAL_CACHE_Z_BIN_COUNT = ${facts.zBinCount};
const int LOCAL_CACHE_SPECTRAL_GROUP_COUNT = ${facts.spectralGroupCount};
const float LOCAL_CACHE_INCIDENT_DIRECTION_WEIGHT = ${formatFloat(facts.directionWeight)};
const float LOCAL_CACHE_GOLDEN_RATIO = 1.6180339887498948482;
const float LOCAL_CACHE_Z_BINS_METERS[${facts.zBinCount}] = float[${facts.zBinCount}](${formatFloatArray(facts.zBinsMeters)});
const float LOCAL_CACHE_RHO_BINS_METERS[${facts.rhoBinCount}] = float[${facts.rhoBinCount}](${formatFloatArray(facts.rhoBinsMeters)});`),
			shaderBlock('cache-texture-access', 'lookupIncidentRadiance', 5, `int zSpectralGroupDepthIndex(int zBinIndex, int spectralGroupIndex) {
	int clampedZBinIndex = clamp(zBinIndex, 0, LOCAL_CACHE_Z_BIN_COUNT - 1);
	int clampedSpectralGroupIndex = clamp(spectralGroupIndex, 0, LOCAL_CACHE_SPECTRAL_GROUP_COUNT - 1);
	return clampedZBinIndex * LOCAL_CACHE_SPECTRAL_GROUP_COUNT + clampedSpectralGroupIndex;
}

vec4 readLocalIncidentRadianceTexture(sampler3D sourceTexture, int zBinIndex, int rhoBinIndex, int directionIndex, int spectralGroupIndex) {
	int clampedDirectionIndex = clamp(directionIndex, 0, LOCAL_CACHE_DIRECTION_COUNT - 1);
	int clampedRhoBinIndex = clamp(rhoBinIndex, 0, LOCAL_CACHE_RHO_BIN_COUNT - 1);
	int depthIndex = zSpectralGroupDepthIndex(zBinIndex, spectralGroupIndex);
	return texelFetch(sourceTexture, ivec3(clampedDirectionIndex, clampedRhoBinIndex, depthIndex), 0);
}

float unpackLocalIncidentRadianceChannel(int zBinIndex, int rhoBinIndex, int directionIndex, int channelIndex) {
	int spectralGroupIndex = channelIndex / ${SPECTRAL_GROUP_SIZE};
	int componentIndex = channelIndex - spectralGroupIndex * ${SPECTRAL_GROUP_SIZE};
	vec4 packed = readLocalIncidentRadianceTexture(
		uIncidentRadianceCacheTexture,
		zBinIndex,
		rhoBinIndex,
		directionIndex,
		spectralGroupIndex
	);
	if (componentIndex == 0) return packed.r;
	if (componentIndex == 1) return packed.g;
	if (componentIndex == 2) return packed.b;
	return packed.a;
}`),
			shaderBlock('cache-lookup-helper', 'lookupIncidentRadiance', 10, `vec3 localIncidentDirection(int directionIndex) {
	float index = float(directionIndex);
	float z = 1.0 - (2.0 * (index + 0.5)) / float(LOCAL_CACHE_DIRECTION_COUNT);
	float horizontalScale = sqrt(max(0.0, 1.0 - z * z));
	float longitude = index * 3.14159265358979323846 * (3.0 - sqrt(5.0));
	return normalize(vec3(
		horizontalScale * cos(longitude),
		horizontalScale * sin(longitude),
		z
	));
}

SpectralValue lookupIncidentRadiance(vec3 positionMeters, int directionIndex) {
	int zBinIndex = nearestLocalCacheZBinIndex(positionMeters);
	int rhoBinIndex = nearestLocalCacheRhoBinIndex(positionMeters);
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = unpackLocalIncidentRadianceChannel(
			zBinIndex,
			rhoBinIndex,
			directionIndex,
			channelIndex
		);
	}
	return radiance;
}`),
		]),
		mainHooks: Object.freeze([
			shaderBlock('cache-main-lookup', 'lookupIncidentRadiance', 0, 'state.incidentRadiance = lookupIncidentRadiance(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0), 0);'),
		]),
		diagnostics: Object.freeze({
			texture: cacheTexture,
			depthPacking: facts.depthPacking,
			lookupPolicy: facts.lookupPolicy,
		}),
	});
}

/**
 * Normalize local cache facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies descriptor.
 * @returns {object} Return normalized cache facts.
 */
function resolveLocalCacheFacts(descriptor) {
	const facts = descriptor.cache.facts ?? {};
	const geometryFacts = descriptor.geometry?.facts ?? {};
	const metadata = facts.metadata ?? {};
	const lookup = facts.lookup ?? {};
	const texture = facts.texture ?? {};
	const payloadDimensions = facts.payloadDimensions ?? [];
	const zBinsMeters = facts.zBinsMeters ?? lookup.zBinsMeters ?? geometryFacts.cacheZBinsMeters ?? [0];
	const rhoBinsMeters = facts.rhoBinsMeters ?? lookup.rhoBinsMeters ?? geometryFacts.cacheRhoBinsMeters ?? [0];
	const directionCount = facts.directionCount
		?? metadata.directionCount
		?? texture.width
		?? RUNTIME_NUMERICAL_CONTROLS.incidentDirectionCount;
	const zBinCount = facts.zBinCount ?? metadata.zBinCount ?? payloadDimensions[0] ?? zBinsMeters.length;
	const rhoBinCount = facts.rhoBinCount ?? metadata.rhoBinCount ?? payloadDimensions[1] ?? rhoBinsMeters.length;
	const spectralGroupCount = facts.spectralGroupCount ?? texture.spectralGroupCount ?? DEFAULT_SPECTRAL_GROUP_COUNT;

	assertPositiveInteger(directionCount, 'directionCount');
	assertPositiveInteger(zBinCount, 'zBinCount');
	assertPositiveInteger(rhoBinCount, 'rhoBinCount');
	assertPositiveInteger(spectralGroupCount, 'spectralGroupCount');

	return Object.freeze({
		directionCount,
		zBinCount,
		rhoBinCount,
		spectralGroupCount,
		textureId: texture.textureId ?? 'incident-radiance-local-l2',
		valueKey: texture.valueKey ?? 'cache.localIncidentRadianceTexture',
		textureWidth: texture.width ?? directionCount,
		textureHeight: texture.height ?? rhoBinCount,
		textureDepth: texture.depth ?? zBinCount * spectralGroupCount,
		samplerPolicy: texture.samplerPolicy ?? 'nearest-clamp',
		zBinsMeters: Object.freeze([...zBinsMeters]),
		rhoBinsMeters: Object.freeze([...rhoBinsMeters]),
		directionWeight: facts.directionWeight ?? lookup.directionWeight ?? (4 * Math.PI) / directionCount,
		depthPacking: facts.depthPacking ?? lookup.depthPacking ?? 'z-then-spectral-group',
		lookupPolicy: facts.lookupPolicy ?? metadata.lookupPolicy ?? lookup.policy ?? 'nearest-neighbor-poc-grid',
	});
}

/**
 * Assert that the descriptor has cache facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {void}
 */
function assertCacheDescriptor(descriptor) {
	if (!descriptor?.cache) {
		throw new TypeError('LocalSunIncidentRadianceCache shader contribution requires a cache descriptor.');
	}
}

/**
 * Assert a positive integer.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {string} label - Supplies label.
 * @returns {void}
 */
function assertPositiveInteger(value, label) {
	if (!Number.isInteger(value) || value < 1) {
		throw new RangeError(`${label} must be a positive integer.`);
	}
}

/**
 * Create one contribution object.
 *
 * @param {Partial<ShaderContribution>} configuration - Supplies contribution fields.
 * @returns {ShaderContribution} Return contribution.
 */
function shaderContribution(configuration) {
	return Object.freeze({
		defines: Object.freeze([]),
		uniforms: Object.freeze([]),
		textures: Object.freeze([]),
		functions: Object.freeze([]),
		mainHooks: Object.freeze([]),
		bindingRequirements: Object.freeze([]),
		diagnostics: null,
		...configuration,
	});
}

/**
 * Create one shader source block.
 *
 * @param {string} id - Supplies block id.
 * @param {ShaderSourceSlot} slot - Supplies assembly slot.
 * @param {number} order - Supplies slot-local order.
 * @param {string} code - Supplies GLSL source.
 * @returns {ShaderSourceBlock} Return source block.
 */
function shaderBlock(id, slot, order, code) {
	return Object.freeze({ id, slot, order, code });
}

/**
 * Create one texture descriptor.
 *
 * @param {string} name - Supplies GLSL sampler name.
 * @param {string} type - Supplies sampler type.
 * @param {string} valueKey - Supplies runtime value key.
 * @returns {ShaderTextureDescriptor} Return texture descriptor.
 */
function shaderTexture(name, type, valueKey) {
	return Object.freeze({ name, type, valueKey });
}

/**
 * Create one binding requirement.
 *
 * @param {string} id - Supplies binding id.
 * @param {string} owner - Supplies binding owner.
 * @param {string} kind - Supplies binding kind.
 * @param {string} updateFrequency - Supplies update cadence.
 * @param {string} valueKey - Supplies runtime value key.
 * @param {boolean} required - Supplies whether setup must provide the value.
 * @returns {ShaderBindingRequirement} Return binding requirement.
 */
function shaderBinding(id, owner, kind, updateFrequency, valueKey, required) {
	return Object.freeze({ id, owner, kind, updateFrequency, valueKey, required });
}

/**
 * Format one number for GLSL output.
 *
 * @param {number} value - Supplies the value.
 * @returns {string} Return formatted GLSL number text.
 */
function formatFloat(value) {
	if (Number.isInteger(value)) {
		return value.toFixed(1);
	}

	return Number(value).toPrecision(12);
}

/**
 * Format numeric array entries for GLSL output.
 *
 * @param {readonly number[]} values - Supplies values.
 * @returns {string} Return formatted entries.
 */
function formatFloatArray(values) {
	return values.map((value) => formatFloat(value)).join(', ');
}

export default LocalSunIncidentRadianceCache;
