import { sourceOrientedFibonacciSphereDirection } from './IncidentRadianceDirections.js';
import TextureBuilder from '../shader/TextureBuilder.js';
import { RUNTIME_NUMERICAL_CONTROLS } from '../constants/Algorithm32CanonicalData.js';

const SPECTRAL_GROUP_SIZE = 4;
const DEFAULT_SPECTRAL_GROUP_COUNT = 4;

/**
 * Own a distant-sun incident-radiance cache and its CPU/GPU payloads.
 */
export class DistantSunIncidentRadianceCache {
	/**
	 * Create a distant-sun incident-radiance cache.
	 *
	 * @param {DistantIncidentRadianceCacheConfig} configuration - Supplies
	 * cache descriptor, dimensions, source direction, and spectral basis.
	 */
	constructor(configuration) {
		if (!configuration || typeof configuration !== 'object') {
			throw new TypeError('DistantSunIncidentRadianceCache configuration is required.');
		}

		const {
			sourceKey = 'distant-sun',
			bottomRadiusMeters,
			topRadiusMeters,
			altitudeBinCount,
			directionCount,
			directionToLight,
			spectralBasis,
			boundaryAltitudeMeters = 2,
			altitudeLookup = null,
		} = configuration;

		if (
			!sourceKey
			|| typeof sourceKey !== 'string'
			|| !Number.isFinite(bottomRadiusMeters)
			|| !Number.isFinite(topRadiusMeters)
			|| topRadiusMeters <= bottomRadiusMeters
			|| !Number.isInteger(altitudeBinCount)
			|| altitudeBinCount < 1
			|| !Number.isInteger(directionCount)
			|| directionCount < 1
			|| !Number.isFinite(boundaryAltitudeMeters)
			|| boundaryAltitudeMeters < 0
		) {
			throw new TypeError('Distant cache requires descriptor, radii, and positive integer dimensions.');
		}

		assertSpectralBasis(spectralBasis);
		assertUnitVector(directionToLight, 'directionToLight');

		this._configuration = Object.freeze({
			sourceKey,
			bottomRadiusMeters,
			topRadiusMeters,
			altitudeBinCount,
			directionCount,
			directionToLight: Object.freeze([...directionToLight]),
			spectralBasis,
			boundaryAltitudeMeters,
			altitudeLookup: normalizeAltitudeLookup(altitudeLookup),
		});
		this._valuesByKey = new Map();
	}

	/**
	 * Return the cache-owned descriptor for the current generated layout.
	 *
	 * @returns {IncidentRadianceCacheDescriptor} The cache descriptor.
	 */
	get descriptor() {
		return createDistantCacheDescriptor(this._configuration, this._valuesByKey.size);
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
	 * Return cache-owned build coordinates.
	 *
	 * @returns {Iterable<CacheBuildCoordinate>} Cache-owned build coordinates.
	 */
	*coordinates() {
		const atmosphereHeight =
			this._configuration.topRadiusMeters - this._configuration.bottomRadiusMeters;

		for (let altitudeBinIndex = 0; altitudeBinIndex < this._configuration.altitudeBinCount; altitudeBinIndex += 1) {
			const altitudeMeters = this._altitudeMetersForBin(altitudeBinIndex, atmosphereHeight);

			for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
				yield Object.freeze({
					coordinateKey: this._key(altitudeBinIndex, directionIndex),
					coordinates: Object.freeze([altitudeBinIndex, directionIndex]),
					altitudeBinIndex,
					directionIndex,
					altitudeMeters,
					incomingDirection: this._incomingDirection(directionIndex),
					metadata: Object.freeze({
						angularWeight: (4 * Math.PI) / this._configuration.directionCount,
						boundarySamplePolicy: altitudeBinIndex === 0
							? 'minimum-in-atmosphere-altitude'
							: 'uniform-bin-center',
					}),
				});
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
			throw new TypeError('Distant cache coordinate build requires coordinate, geometry, and calculator.');
		}

		if (typeof geometry.resolveCacheBuildRay !== 'function') {
			throw new TypeError('Distant cache coordinate build requires geometry.resolveCacheBuildRay.');
		}

		const key = this._key(coordinate.altitudeBinIndex, coordinate.directionIndex);
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
			const altitudeBinIndex = cacheAccess?.coordinates?.[0];

			if (!Number.isInteger(altitudeBinIndex)) {
				throw new TypeError('Distant cache access requires altitude bin coordinate.');
			}

			const samples = [];
			const weight = (4 * Math.PI) / this._configuration.directionCount;

			for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
				const key = this._key(altitudeBinIndex, directionIndex);
				const radiance = this._valuesByKey.get(key);

				if (!radiance) {
					throw new Error(`Distant incident radiance cache is missing ${key}.`);
				}

				samples.push(Object.freeze({
					incomingDirection: this._incomingDirection(directionIndex),
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
		const rgbaFloat32 = [];

		for (let spectralGroupIndex = 0; spectralGroupIndex < spectralGroupCount; spectralGroupIndex += 1) {
			for (let altitudeBinIndex = 0; altitudeBinIndex < this._configuration.altitudeBinCount; altitudeBinIndex += 1) {
				for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
					const key = this._key(altitudeBinIndex, directionIndex);
					const radiance = this._valuesByKey.get(key);

					if (!radiance) {
						throw new Error(`Distant incident radiance cache is missing ${key}.`);
					}

					for (let componentIndex = 0; componentIndex < SPECTRAL_GROUP_SIZE; componentIndex += 1) {
						const channelIndex = spectralGroupIndex * SPECTRAL_GROUP_SIZE + componentIndex;
						rgbaFloat32.push(channelIndex < spectralChannelCount ? radiance[channelIndex] : 0);
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
	 * Create the cache-owned distant incident-radiance shader contribution.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active shader descriptor.
	 * @returns {ShaderContribution} The cache shader contribution.
	 */
	createShaderContribution(request) {
		return this._createShaderContribution(request?.descriptor);
	}

	/**
	 * Create the cache-owned distant incident-radiance shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @param {TextureBuilder} [textureBuilder] - Supplies the texture descriptor builder.
	 * @returns {ShaderContribution} Return the cache contribution.
	 */
	_createShaderContribution(descriptor, textureBuilder = new TextureBuilder()) {
		assertCacheDescriptor(descriptor);
		const cacheFacts = resolveDistantCacheFacts(descriptor);
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
			accessFunctionName: 'readIncidentRadianceTexture',
		});

		return createDistantCacheShaderContribution(descriptor, cacheTexture, cacheFacts);
	}

	_key(altitudeBinIndex, directionIndex) {
		if (!Number.isInteger(altitudeBinIndex) || !Number.isInteger(directionIndex)) {
			throw new TypeError('Distant cache coordinate indices must be integers.');
		}

		return `${altitudeBinIndex}:${directionIndex}`;
	}

	_altitudeMetersForBin(altitudeBinIndex, atmosphereHeight) {
		if (altitudeBinIndex === 0) {
			return Math.min(
				atmosphereHeight,
				Math.max(0, this._configuration.boundaryAltitudeMeters),
			);
		}

		return ((altitudeBinIndex + 0.5) / this._configuration.altitudeBinCount) * atmosphereHeight;
	}

	_incomingDirection(directionIndex) {
		return sourceOrientedFibonacciSphereDirection(
			directionIndex,
			this._configuration.directionCount,
			this._configuration.directionToLight,
		);
	}

	_zero() {
		return Object.freeze(Array.from({ length: getSpectralChannelCount(this._configuration.spectralBasis) }, () => 0));
	}
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
 * Create the cache-owned descriptor from the active distant cache layout.
 *
 * @param {object} configuration - Supplies the cache configuration.
 * @param {number} valueCount - Supplies the generated coordinate count.
 * @returns {IncidentRadianceCacheDescriptor} The cache descriptor.
 */
function createDistantCacheDescriptor(configuration, valueCount) {
	const spectralChannelCount = getSpectralChannelCount(configuration.spectralBasis);
	const spectralGroupCount = Math.ceil(spectralChannelCount / SPECTRAL_GROUP_SIZE);
	const uploadValueCount = configuration.directionCount
		* configuration.altitudeBinCount
		* spectralGroupCount
		* 4;

	return Object.freeze({
		cacheKind: 'distant',
		sourceKey: configuration.sourceKey,
		version: 1,
		payloadKind: 'distant-incident-radiance-cache',
		dimensions: Object.freeze(['altitude', 'incomingDirection', 'wavelength']),
		payloadDimensions: Object.freeze([
			configuration.altitudeBinCount,
			configuration.directionCount,
			spectralChannelCount,
		]),
		texture: Object.freeze({
			kind: 'rgba32f-3d-texture-v1',
			textureId: 'incident-radiance-distant-l2',
			valueKey: 'cache.incidentRadianceTexture',
			width: configuration.directionCount,
			height: configuration.altitudeBinCount,
			depth: spectralGroupCount,
			dimensionality: '3d',
			format: 'rgba32f',
			samplerPolicy: 'nearest-clamp',
			coordinateOrder: Object.freeze(['directionIndex', 'altitudeBinIndex', 'spectralGroupIndex']),
			spectralGroupSize: SPECTRAL_GROUP_SIZE,
			spectralGroupCount,
			spectralChannelCount,
		}),
		lookup: Object.freeze({
			policy: 'altitude-bin-all-directions',
			directionSequence: 'source-oriented-fibonacci-sphere',
			directionWeight: (4 * Math.PI) / configuration.directionCount,
			boundaryAltitudeMeters: configuration.boundaryAltitudeMeters,
			altitudeLookup: configuration.altitudeLookup,
		}),
		metadata: Object.freeze({
			altitudeBinCount: configuration.altitudeBinCount,
			directionCount: configuration.directionCount,
			boundaryAltitudeMeters: configuration.boundaryAltitudeMeters,
			boundarySamplePolicy: 'first-altitude-bin-samples-minimum-in-atmosphere-altitude',
			valueCount,
			uploadValueCount,
		}),
		altitudeLookup: configuration.altitudeLookup,
	});
}

/**
 * Assert a finite three-component direction tuple.
 *
 * @param {unknown} vector - Supplies the candidate vector.
 * @param {string} label - Supplies the error label.
 * @returns {void}
 */
function assertUnitVector(vector, label) {
	if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(Number.isFinite)) {
		throw new TypeError(`${label} must be a finite three-component vector.`);
	}
}

/**
 * Normalize an optional altitude lookup policy.
 *
 * @param {unknown} altitudeLookup - Supplies candidate lookup policy.
 * @returns {object | null} Return normalized policy.
 */
function normalizeAltitudeLookup(altitudeLookup) {
	if (altitudeLookup == null) {
		return null;
	}

	if (
		typeof altitudeLookup === 'object'
		&& ['nearest-bin', 'linear-altitude-v1'].includes(altitudeLookup.kind)
	) {
		return Object.freeze({
			kind: altitudeLookup.kind,
		});
	}

	throw new TypeError('Distant cache altitudeLookup must be nearest-bin or linear-altitude-v1.');
}

/**
 * Create the distant incident-cache shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @param {ShaderTextureBuildResult} cacheTexture - Supplies the cache texture descriptor.
 * @param {object} cacheFacts - Supplies normalized cache facts.
 * @returns {ShaderContribution} Return the cache contribution.
 */
function createDistantCacheShaderContribution(descriptor, cacheTexture, cacheFacts) {
	const cacheLookupHelper = cacheIncidentRadianceLookupHelper(
		cacheFacts.altitudeLookup?.kind ?? 'nearest-bin',
	);

	return shaderContribution({
		id: 'cache-distant-l2-incident-radiance',
		owner: 'cache',
		descriptorFingerprint: descriptor.cache.fingerprint,
		compatibilityTags: descriptor.cache.compatibilityTags,
		provides: Object.freeze(['cache.lookupIncidentRadiance']),
		requires: Object.freeze(['geometry.cacheAccessCoordinate']),
		textures: Object.freeze([
			shaderTexture('uIncidentRadianceCacheTexture', 'sampler3D', cacheTexture.valueKey),
		]),
		bindingRequirements: Object.freeze([
			shaderBinding('cache.incidentRadianceTexture', 'cache', 'texture', 'setup', cacheTexture.valueKey, true),
		]),
		functions: Object.freeze([
			shaderBlock('cache-constants', 'declareConstants', 0, `const int CACHE_INCIDENT_DIRECTION_COUNT = ${cacheFacts.incidentDirectionCount};
const int CACHE_INCIDENT_ALTITUDE_BIN_COUNT = ${cacheFacts.incidentAltitudeBinCount};
const int CACHE_SPECTRAL_GROUP_COUNT = ${cacheFacts.spectralGroupCount};
const float CACHE_INCIDENT_DIRECTION_WEIGHT = ${formatFloat((4 * Math.PI) / cacheFacts.incidentDirectionCount)};
const float CACHE_GOLDEN_RATIO = 1.6180339887498948482;`),
			shaderBlock('cache-texture-access', 'lookupIncidentRadiance', 5, `vec4 readIncidentRadianceTexture(sampler3D sourceTexture, int altitudeBinIndex, int directionIndex, int spectralGroupIndex) {
	int clampedAltitudeBinIndex = clamp(altitudeBinIndex, 0, CACHE_INCIDENT_ALTITUDE_BIN_COUNT - 1);
	int clampedDirectionIndex = clamp(directionIndex, 0, CACHE_INCIDENT_DIRECTION_COUNT - 1);
	int clampedSpectralGroupIndex = clamp(spectralGroupIndex, 0, CACHE_SPECTRAL_GROUP_COUNT - 1);
	return texelFetch(sourceTexture, ivec3(clampedDirectionIndex, clampedAltitudeBinIndex, clampedSpectralGroupIndex), 0);
}

float unpackIncidentRadianceChannel(int altitudeBinIndex, int directionIndex, int channelIndex) {
	int spectralGroupIndex = channelIndex / ${SPECTRAL_GROUP_SIZE};
	int componentIndex = channelIndex - spectralGroupIndex * ${SPECTRAL_GROUP_SIZE};
	vec4 packed = readIncidentRadianceTexture(uIncidentRadianceCacheTexture, altitudeBinIndex, directionIndex, spectralGroupIndex);
	if (componentIndex == 0) return packed.r;
	if (componentIndex == 1) return packed.g;
	if (componentIndex == 2) return packed.b;
	return packed.a;
}

float unpackIncidentRadianceChannelInterpolated(float altitudeBinCoordinate, int directionIndex, int channelIndex) {
	int lowerAltitudeBinIndex = int(floor(altitudeBinCoordinate));
	int upperAltitudeBinIndex = lowerAltitudeBinIndex + 1;
	float blend = clamp(altitudeBinCoordinate - float(lowerAltitudeBinIndex), 0.0, 1.0);
	float lowerRadiance = unpackIncidentRadianceChannel(lowerAltitudeBinIndex, directionIndex, channelIndex);
	float upperRadiance = unpackIncidentRadianceChannel(upperAltitudeBinIndex, directionIndex, channelIndex);
	return mix(lowerRadiance, upperRadiance, blend);
}`),
			shaderBlock('cache-lookup-helper', 'lookupIncidentRadiance', 10, `vec3 cacheBasisReference(vec3 sunAxis) {
	return abs(dot(sunAxis, vec3(0.0, 0.0, 1.0))) < 0.95
		? vec3(0.0, 0.0, 1.0)
		: vec3(0.0, 1.0, 0.0);
}

vec3 sunOrientedIncidentDirection(int directionIndex) {
	int halfCount = CACHE_INCIDENT_DIRECTION_COUNT / 2;
	float centeredIndex = float(directionIndex - halfCount);
	vec3 sunAxis = normalize(uDistantSunDirection);
	vec3 reference = cacheBasisReference(sunAxis);
	vec3 zAxis = normalize(reference - sunAxis * dot(reference, sunAxis));
	vec3 yAxis = normalize(cross(zAxis, sunAxis));
	float z = (2.0 * centeredIndex) / float(CACHE_INCIDENT_DIRECTION_COUNT);
	float latitude = asin(z);
	float longitude = (2.0 * 3.14159265358979323846 * centeredIndex) / CACHE_GOLDEN_RATIO;
	float horizontalScale = cos(latitude);
	float localX = horizontalScale * cos(longitude);
	float localY = horizontalScale * sin(longitude);
	float localZ = z;
	return normalize(sunAxis * localX + yAxis * localY + zAxis * localZ);
}

${cacheLookupHelper}`),
		]),
		mainHooks: Object.freeze([
			shaderBlock('cache-main-lookup', 'lookupIncidentRadiance', 0, 'state.incidentRadiance = lookupIncidentRadiance(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0), 0);'),
		]),
		diagnostics: Object.freeze({
			texture: cacheTexture,
			altitudeLookup: cacheFacts.altitudeLookup ?? Object.freeze({ kind: 'nearest-bin' }),
		}),
	});
}

/**
 * Build the cache lookup helper for the selected altitude policy.
 *
 * @param {string} kind - Supplies the lookup policy kind.
 * @returns {string} Return GLSL source.
 */
function cacheIncidentRadianceLookupHelper(kind) {
	if (kind === 'linear-altitude-v1') {
		return `SpectralValue lookupIncidentRadiance(vec3 positionMeters, int directionIndex) {
	float altitudeBinCoordinate = resolveCacheAltitudeBinCoordinate(positionMeters);
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = unpackIncidentRadianceChannelInterpolated(altitudeBinCoordinate, directionIndex, channelIndex);
	}
	return radiance;
}`;
	}

	return `SpectralValue lookupIncidentRadiance(vec3 positionMeters, int directionIndex) {
	int altitudeBinIndex = resolveCacheAltitudeBinIndex(positionMeters);
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = unpackIncidentRadianceChannel(altitudeBinIndex, directionIndex, channelIndex);
	}
	return radiance;
}`;
}

/**
 * Normalize distant incident-cache descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {object} Return normalized cache facts.
 */
function resolveDistantCacheFacts(descriptor) {
	const facts = descriptor.cache.facts ?? {};
	const metadata = facts.metadata ?? {};
	const texture = facts.texture ?? {};
	const incidentDirectionCount = facts.incidentDirectionCount
		?? facts.directionCount
		?? metadata.directionCount
		?? texture.width
		?? RUNTIME_NUMERICAL_CONTROLS.incidentDirectionCount;
	const incidentAltitudeBinCount = facts.incidentAltitudeBinCount
		?? facts.altitudeBinCount
		?? metadata.altitudeBinCount
		?? texture.height
		?? RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount;
	const spectralGroupCount = facts.spectralGroupCount
		?? texture.spectralGroupCount
		?? DEFAULT_SPECTRAL_GROUP_COUNT;

	assertPositiveInteger(incidentDirectionCount, 'incidentDirectionCount');
	assertPositiveInteger(incidentAltitudeBinCount, 'incidentAltitudeBinCount');
	assertPositiveInteger(spectralGroupCount, 'spectralGroupCount');

	return Object.freeze({
		incidentDirectionCount,
		incidentAltitudeBinCount,
		spectralGroupCount,
		textureId: texture.textureId ?? 'incident-radiance-distant-l2',
		valueKey: texture.valueKey ?? 'cache.incidentRadianceTexture',
		textureWidth: texture.width ?? incidentDirectionCount,
		textureHeight: texture.height ?? incidentAltitudeBinCount,
		textureDepth: texture.depth ?? spectralGroupCount,
		samplerPolicy: texture.samplerPolicy ?? 'nearest-clamp',
		altitudeLookup: facts.altitudeLookup,
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
		throw new TypeError('DistantSunIncidentRadianceCache shader contribution requires a cache descriptor.');
	}
}

/**
 * Assert a positive integer.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {string} label - Supplies the label.
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

export default DistantSunIncidentRadianceCache;
