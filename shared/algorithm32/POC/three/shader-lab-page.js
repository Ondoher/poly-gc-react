import * as THREE from 'three';

let algorithm32AtmospherePassInstanceCounter = 0;

export const CAPTURED_SCENE_ENDPOINT_COMPOSITION_POLICY =
	'captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy';

export class Algorithm32AtmospherePass {
	constructor({
		renderer,
		width,
		height,
		camera,
		config,
		mode = 'identity',
		maxDistanceMeters,
	}) {
		this.renderer = renderer;
		this.instanceId = `algorithm32-atmosphere-pass-${++algorithm32AtmospherePassInstanceCounter}`;
		this.width = width;
		this.height = height;
		this.mode = mode;
		this.maxDistanceMeters = maxDistanceMeters;
		this.config = config || {};
		this.sceneRenderTarget = this.createSceneRenderTarget(width, height);
		this.passScene = new THREE.Scene();
		this.passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.material = this.createMaterial({ camera });
		this.fullscreenQuad = new THREE.Mesh(
			new THREE.PlaneGeometry(2, 2),
			this.material
		);
		this.passScene.add(this.fullscreenQuad);
	}

	createSceneRenderTarget(width, height) {
		const renderTarget = new THREE.WebGLRenderTarget(width, height, {
			format: THREE.RGBAFormat,
			type: THREE.UnsignedByteType,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			depthBuffer: true,
			stencilBuffer: false,
		});
		renderTarget.texture.name = 'Algorithm32AtmospherePass.sceneColor';
		if ('colorSpace' in renderTarget.texture) {
			renderTarget.texture.colorSpace =
				this.renderer.outputColorSpace || THREE.SRGBColorSpace;
		}
		renderTarget.depthTexture = new THREE.DepthTexture(
			width,
			height,
			THREE.UnsignedIntType
		);
		renderTarget.depthTexture.name = 'Algorithm32AtmospherePass.sceneDepth';
		renderTarget.depthTexture.format = THREE.DepthFormat;
		renderTarget.depthTexture.minFilter = THREE.NearestFilter;
		renderTarget.depthTexture.magFilter = THREE.NearestFilter;
		return renderTarget;
	}

	createMaterial({ camera }) {
		return new THREE.ShaderMaterial({
			glslVersion: THREE.GLSL3,
			depthTest: false,
			depthWrite: false,
			toneMapped: false,
			uniforms: {
				sceneColorTexture: { value: this.sceneRenderTarget.texture },
				sceneDepthTexture: { value: this.sceneRenderTarget.depthTexture },
				sourceProjectionMatrixInverse: {
					value: camera.projectionMatrixInverse.clone(),
				},
				sourceCameraMatrixWorld: { value: camera.matrixWorld.clone() },
				sourceCameraPosition: { value: camera.position.clone() },
				maxDistanceMeters: { value: this.maxDistanceMeters },
				resolution: { value: new THREE.Vector2(this.width, this.height) },
				sunRayAlgorithm: {
					value: new THREE.Vector3(
						...sourceSunDirectionForPassConfig(this.config)
					),
				},
				localSourcePosition: {
					value: new THREE.Vector3(
						...localSourcePositionForPassConfig(this.config)
					),
				},
				localIncidentCacheTexture: {
					value: localIncidentCacheTextureForPassConfig(this.config),
				},
				localIncidentCacheAvailable: {
					value: localIncidentCacheAvailableForPassConfig(this.config),
				},
				localIncidentCacheDimensions: {
					value: new THREE.Vector3(
						...localIncidentCacheDimensionsForPassConfig(this.config)
					),
				},
				localIncidentZBinCount: {
					value: localIncidentZBinsForPassConfig(this.config).count,
				},
				localIncidentRhoBinCount: {
					value: localIncidentRhoBinsForPassConfig(this.config).count,
				},
				localIncidentDirectionCount: {
					value: localIncidentDirectionsForPassConfig(this.config).count,
				},
				localIncidentSpectralGroupCount: {
					value: localIncidentSpectralGroupCountForPassConfig(this.config),
				},
				localIncidentZBins: {
					value: localIncidentZBinsForPassConfig(this.config).values,
				},
				localIncidentRhoBins: {
					value: localIncidentRhoBinsForPassConfig(this.config).values,
				},
				localIncidentDirections: {
					value: localIncidentDirectionsForPassConfig(this.config).values,
				},
				topAltitudeMeters: {
					value: this.config?.geometry?.topAltitudeMeters ?? 100000,
				},
				sceneSkyRayLimitMeters: {
					value: this.config?.geometry?.sceneSkyRayLimitMeters ?? 1926774,
				},
				referenceDistanceKm: {
					value: this.config?.source?.referenceDistanceKm ?? 4800,
				},
				referenceSpectralIncidentScale: {
					value:
						this.config?.source?.referenceSpectralIncidentScale ?? 1,
				},
				distanceFalloff: {
					value: this.config?.source?.distanceFalloff === false ? 0 : 1,
				},
				sourceColor: {
					value: new THREE.Vector3(
						this.config?.source?.color?.r ?? 1,
						this.config?.source?.color?.g ?? 0.98,
						this.config?.source?.color?.b ?? 0.95
					),
				},
				debugViewMode: {
					value: debugViewModeCode(this.config?.display?.debugView),
				},
				starFieldEnabled: {
					value: starFieldEnabledForPassConfig(this.config),
				},
				starFieldIntensity: {
					value: starFieldIntensityForPassConfig(this.config),
				},
				starFieldDensity: {
					value: starFieldDensityForPassConfig(this.config),
				},
				starFieldPointSize: {
					value: starFieldPointSizeForPassConfig(this.config),
				},
				passMode: { value: threeNativePassModeCode(this.mode) },
			},
			vertexShader: `
out vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,
			fragmentShader: `
precision highp float;
precision highp sampler2D;
precision highp sampler3D;

uniform sampler2D sceneColorTexture;
uniform sampler2D sceneDepthTexture;
uniform sampler3D localIncidentCacheTexture;
uniform mat4 sourceProjectionMatrixInverse;
uniform mat4 sourceCameraMatrixWorld;
uniform vec3 sourceCameraPosition;
uniform float maxDistanceMeters;
uniform vec2 resolution;
uniform vec3 sunRayAlgorithm;
uniform vec3 localSourcePosition;
uniform int localIncidentCacheAvailable;
uniform vec3 localIncidentCacheDimensions;
uniform int localIncidentZBinCount;
uniform int localIncidentRhoBinCount;
uniform int localIncidentDirectionCount;
uniform int localIncidentSpectralGroupCount;
uniform float localIncidentZBins[8];
uniform float localIncidentRhoBins[8];
uniform vec3 localIncidentDirections[16];
uniform float topAltitudeMeters;
uniform float sceneSkyRayLimitMeters;
uniform float referenceDistanceKm;
uniform float referenceSpectralIncidentScale;
uniform int distanceFalloff;
uniform vec3 sourceColor;
uniform int debugViewMode;
uniform int starFieldEnabled;
uniform float starFieldIntensity;
uniform float starFieldDensity;
uniform float starFieldPointSize;
uniform int passMode;

in vec2 vUv;
out vec4 outColor;

const int CHANNEL_COUNT = 15;
const int VIEW_SAMPLES = 20;
const int SUN_TRANSMITTANCE_SAMPLES = 10;
const int LOCAL_SECOND_ORDER_INCOMING_DIRECTIONS = 17;
const int MAX_LOCAL_CACHE_Z_BINS = 8;
const int MAX_LOCAL_CACHE_RHO_BINS = 8;
const int MAX_LOCAL_CACHE_DIRECTION_BINS = 16;
const float BOTTOM_RADIUS_METERS = 6360000.0;
const float TOP_RADIUS_METERS = 6420000.0;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SINGLE_SCATTERING_ALBEDO = 0.8;
const float MIE_PHASE_G = 0.7;
const float PI = 3.141592653589793;
const float SPECTRAL_DELTA_NM = 31.333333333333332;
const float MAX_LUMINOUS_EFFICACY = 683.0;
const float DISPLAY_TONE_MAP_K = 0.00029282576866764276;
const float SUN_APPARENT_VISUAL_MAGNITUDE = -26.74;
const float BRIGHTEST_STAR_VISUAL_MAGNITUDE = -1.46;
const float NAKED_EYE_LIMITING_MAGNITUDE = 6.0;
const float WAVELENGTHS_NM[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	375.666666666667,
	407.0,
	438.333333333333,
	469.666666666667,
	501.0,
	532.333333333333,
	563.666666666667,
	595.0,
	626.333333333333,
	657.666666666667,
	689.0,
	720.333333333333,
	751.666666666667,
	783.0,
	814.333333333333
);
const float SOLAR_IRRADIANCE[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	1.068866666667,
	1.729673,
	1.862071666667,
	2.022063333333,
	1.908154,
	1.883391,
	1.834246666667,
	1.76744,
	1.65952,
	1.548102333333,
	1.45078,
	1.340960333333,
	1.262433333333,
	1.175208,
	1.090824
);
const vec3 CIE[CHANNEL_COUNT] = vec3[CHANNEL_COUNT](
	vec3(0.00082512, 0.000024284, 0.00388120013333),
	vec3(0.031318, 0.000868, 0.14908),
	vec3(0.341686666667, 0.0209466666667, 1.70569333333),
	vec3(0.199076, 0.0898413333333, 1.30367066667),
	vec3(0.0044, 0.33986, 0.26006),
	vec3(0.19361662, 0.88666338, 0.0364106666667),
	vec3(0.656026666667, 0.982973333333, 0.00305666593333),
	vec3(1.0567, 0.6949, 0.001),
	vec3(0.722333333333, 0.306066666667, 0.000086666664),
	vec3(0.190006666667, 0.0706133333333, 0.0),
	vec3(0.02474, 0.008952, 0.0),
	vec3(0.0028426512, 0.00102653333333, 0.0),
	vec3(0.000299809433333, 0.000108266666667, 0.0),
	vec3(0.000034215932, 0.000012356, 0.0),
	vec3(0.00000378221413333, 0.00000136582666667, 0.0)
);

vec3 linearToSrgb(vec3 value) {
	vec3 low = value * 12.92;
	vec3 high = 1.055 * pow(max(value, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
	return mix(low, high, step(vec3(0.0031308), value));
}

float rayleighScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometersValue, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometersValue) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS) *
		pow(wavelengthMicrometersValue, -MIE_ANGSTROM_ALPHA);
}

float mieScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
		MIE_SINGLE_SCATTERING_ALBEDO;
}

float transmittanceAt(
	float rayleighOpticalLength,
	float mieOpticalLength,
	float wavelengthMicrometersValue
) {
	float opticalDepth =
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighOpticalLength +
		mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
			mieOpticalLength;
	return exp(-opticalDepth);
}

float rayleighPhaseFunction(float nu) {
	return (3.0 / (16.0 * PI)) * (1.0 + nu * nu);
}

float miePhaseFunction(float g, float nu) {
	float k = (3.0 / (8.0 * PI)) *
		((1.0 - g * g) / (2.0 + g * g));

	return (k * (1.0 + nu * nu)) /
		pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

float distanceToTopAtmosphereBoundary(float radius, float mu) {
	float discriminant =
		radius * radius * (mu * mu - 1.0) +
		TOP_RADIUS_METERS * TOP_RADIUS_METERS;

	return max(0.0, -radius * mu + sqrt(max(0.0, discriminant)));
}

bool rayIntersectsGround(float radius, float mu) {
	return
		mu < 0.0 &&
		radius * radius * (mu * mu - 1.0) +
			BOTTOM_RADIUS_METERS * BOTTOM_RADIUS_METERS >=
			0.0;
}

vec2 densityAtPosition(vec3 position) {
	float altitudeMeters = length(position) - BOTTOM_RADIUS_METERS;
	float rayleighDensity =
		exp(-max(0.0, altitudeMeters) / RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity =
		exp(-max(0.0, altitudeMeters) / MIE_SCALE_HEIGHT_METERS);

	return vec2(rayleighDensity, mieDensity);
}

float computeSunTransmittance(vec3 position, float wavelengthMicrometersValue) {
	float radius = length(position);
	float mu = dot(position, sunRayAlgorithm) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0.0;
	}

	float distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
	float stepSize = distanceToTop / float(SUN_TRANSMITTANCE_SAMPLES);
	float rayleighOpticalLength = 0.0;
	float mieOpticalLength = 0.0;

	for (int sampleIndex = 0; sampleIndex <= SUN_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = position + sunRayAlgorithm * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);
		float weight =
			sampleIndex == 0 || sampleIndex == SUN_TRANSMITTANCE_SAMPLES
				? 0.5
				: 1.0;
		rayleighOpticalLength += density.x * weight * stepSize;
		mieOpticalLength += density.y * weight * stepSize;
	}

	return transmittanceAt(
		rayleighOpticalLength,
		mieOpticalLength,
		wavelengthMicrometersValue
	);
}

vec2 firstOrderPathAndViewT(
	vec3 origin,
	vec3 direction,
	float distanceMeters,
	float wavelengthMicrometersValue,
	float solarIrradiance
) {
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float previousRayleigh = 0.0;
	float previousMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);

		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousRayleigh + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousMie + density.y) * stepSize;
		}

		float viewTransmittance = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie,
			wavelengthMicrometersValue
		);
		float sunTransmittance =
			computeSunTransmittance(samplePosition, wavelengthMicrometersValue);
		float transmittance = viewTransmittance * sunTransmittance;
		float weight =
			sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		rayleighSum += transmittance * density.x * weight;
		mieSum += transmittance * density.y * weight;
		previousRayleigh = density.x;
		previousMie = density.y;
	}

	float nu = dot(direction, sunRayAlgorithm);
	float rayleigh =
		rayleighSum *
		stepSize *
		solarIrradiance *
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
		rayleighPhaseFunction(nu);
	float mie =
		mieSum *
		stepSize *
		solarIrradiance *
		mieScatteringCoefficientAt(wavelengthMicrometersValue) *
		miePhaseFunction(MIE_PHASE_G, nu);
	float viewTransmittance = transmittanceAt(
		cumulativeRayleigh,
		cumulativeMie,
		wavelengthMicrometersValue
	);

	return vec2(rayleigh + mie, viewTransmittance);
}

vec3 xyzToDisplayLinearSrgb(vec3 xyz) {
	return MAX_LUMINOUS_EFFICACY * vec3(
		3.2406 * xyz.x + -1.5372 * xyz.y + -0.4986 * xyz.z,
		-0.9689 * xyz.x + 1.8758 * xyz.y + 0.0415 * xyz.z,
		0.0557 * xyz.x + -0.204 * xyz.y + 1.057 * xyz.z
	);
}

vec3 toneMapDisplayLinearSrgb(vec3 linearSrgb) {
	return clamp(
		vec3(1.0) - exp(-DISPLAY_TONE_MAP_K * max(vec3(0.0), linearSrgb)),
		vec3(0.0),
		vec3(1.0)
	);
}

vec3 inverseToneMapDisplayLinearSrgb(vec3 displayRgb) {
	vec3 clamped = clamp(displayRgb, vec3(0.0), vec3(0.999999));
	return -log(vec3(1.0) - clamped) / DISPLAY_TONE_MAP_K;
}

vec3 displayPreview(vec3 xyz) {
	return toneMapDisplayLinearSrgb(xyzToDisplayLinearSrgb(xyz));
}

float hash12(vec2 value) {
	vec3 p3 = fract(vec3(value.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 value) {
	return vec2(
		hash12(value + vec2(17.17, 61.43)),
		hash12(value + vec2(41.91, 11.37))
	);
}

float rayPixelSolidAngleSteradians(vec3 rayDirectionThree) {
	vec3 direction = normalize(rayDirectionThree);
	vec3 dx = dFdx(direction);
	vec3 dy = dFdy(direction);
	return max(1.0e-9, length(cross(dx, dy)));
}

float proceduralStarMagnitude(vec2 cell) {
	float u = max(1.0e-6, hash12(cell + vec2(81.2, 14.9)));
	float magnitude =
		NAKED_EYE_LIMITING_MAGNITUDE + log(u) / log(10.0) / 0.6;
	return max(BRIGHTEST_STAR_VISUAL_MAGNITUDE, magnitude);
}

vec3 pointStarFieldLinearSrgb(
	vec3 rayDirectionThree,
	vec3 transmittanceRgb,
	float pixelSolidAngleSteradians
) {
	if (starFieldEnabled == 0 || starFieldIntensity <= 0.0) {
		return vec3(0.0);
	}
	vec3 direction = normalize(rayDirectionThree);
	if (direction.y <= 0.0) {
		return vec3(0.0);
	}
	float u = atan(direction.z, direction.x) / (2.0 * PI) + 0.5;
	float v = asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5;
	vec2 grid = vec2(260.0, 130.0) * clamp(starFieldDensity, 0.25, 4.0);
	vec2 cell = floor(vec2(u, v) * grid);
	vec2 cellUv = fract(vec2(u, v) * grid);
	float gate = hash12(cell + vec2(3.1, 9.7));
	float coverage = clamp(0.032 * starFieldDensity, 0.006, 0.12);
	if (gate < 1.0 - coverage) {
		return vec3(0.0);
	}
	vec2 starOffset = hash22(cell);
	vec2 delta = cellUv - starOffset;
	delta.x *= max(0.25, cos((v - 0.5) * PI));
	float distanceToStar = length(delta);
	float radius = 0.085 * clamp(starFieldPointSize, 0.35, 3.0);
	float point = smoothstep(radius, 0.0, distanceToStar);
	point = pow(point, 3.0);
	float magnitude = proceduralStarMagnitude(cell);
	float solarFluxRatio = pow(
		10.0,
		-0.4 * (magnitude - SUN_APPARENT_VISUAL_MAGNITUDE)
	);
	vec3 xyz = vec3(0.0);
	for (int channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex++) {
		float spectralRadiance =
			SOLAR_IRRADIANCE[channelIndex] *
			solarFluxRatio /
			pixelSolidAngleSteradians;
		xyz += CIE[channelIndex] * spectralRadiance * SPECTRAL_DELTA_NM;
	}
	return xyzToDisplayLinearSrgb(xyz) * point * starFieldIntensity *
		transmittanceRgb;
}

vec3 composeCapturedSceneEndpointProxy(
	vec2 pixelUv,
	vec3 skyLinearSrgb,
	vec3 transmittanceRgb
) {
	vec3 sceneEndpointLinearSrgb =
		inverseToneMapDisplayLinearSrgb(texture(sceneColorTexture, pixelUv).rgb);
	vec3 finalLinearSrgb =
		skyLinearSrgb + sceneEndpointLinearSrgb * transmittanceRgb;
	return toneMapDisplayLinearSrgb(finalLinearSrgb);
}

vec2 flatDensityAt(vec3 position) {
	float altitudeMeters = position.z;
	if (altitudeMeters < 0.0 || altitudeMeters > topAltitudeMeters) {
		return vec2(0.0);
	}
	return vec2(
		exp(-altitudeMeters / RAYLEIGH_SCALE_HEIGHT_METERS),
		exp(-altitudeMeters / MIE_SCALE_HEIGHT_METERS)
	);
}

float localSpectralScale(float incidentScale, int channelIndex) {
	if (channelIndex < 4) {
		return incidentScale * sourceColor.b;
	}
	if (channelIndex < 8) {
		return incidentScale * sourceColor.g;
	}
	return incidentScale * sourceColor.r;
}

float localSourceTransmittance(
	vec3 position,
	vec3 sourceDirection,
	float sourceDistance,
	float wavelengthMicrometersValue
) {
	if (sourceDirection.z < 0.0) {
		float groundDistance = max(0.0, -position.z / sourceDirection.z);
		if (groundDistance < sourceDistance - 1e-9) {
			return 0.0;
		}
	}
	float topDistance = sourceDirection.z > 0.0
		? max(0.0, (topAltitudeMeters - position.z) / sourceDirection.z)
		: sourceDistance;
	float atmosphereDistance = min(sourceDistance, topDistance);
	if (atmosphereDistance <= 0.0) {
		return 1.0;
	}
	float stepSize = atmosphereDistance / float(SUN_TRANSMITTANCE_SAMPLES);
	float rayleighLength = 0.0;
	float mieLength = 0.0;
	for (int sampleIndex = 0; sampleIndex <= SUN_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		vec3 samplePosition =
			position + sourceDirection * (float(sampleIndex) * stepSize);
		vec2 density = flatDensityAt(samplePosition);
		float weight =
			sampleIndex == 0 || sampleIndex == SUN_TRANSMITTANCE_SAMPLES
				? 0.5
				: 1.0;
		rayleighLength += density.x * weight * stepSize;
		mieLength += density.y * weight * stepSize;
	}
	return transmittanceAt(
		rayleighLength,
		mieLength,
		wavelengthMicrometersValue
	);
}

vec2 localFirstOrderPathAndViewT(
	vec3 origin,
	vec3 direction,
	float distanceMeters,
	int channelIndex
) {
	if (distanceMeters <= 0.0) {
		return vec2(0.0, 1.0);
	}
	float wavelengthNm = WAVELENGTHS_NM[channelIndex];
	float wavelengthMicrometersValue = wavelengthNm * 0.001;
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	vec2 previousDensity = flatDensityAt(origin);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = flatDensityAt(samplePosition);
		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousDensity.x + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousDensity.y + density.y) * stepSize;
		}
		float viewT = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie,
			wavelengthMicrometersValue
		);
		vec3 vectorToSource = localSourcePosition - samplePosition;
		float sourceDistance = length(vectorToSource);
		vec3 sourceDirection = sourceDistance == 0.0
			? vec3(0.0, 0.0, 1.0)
			: vectorToSource / sourceDistance;
		float distanceKm = sourceDistance / 1000.0;
		float falloff = distanceFalloff == 1
			? pow(referenceDistanceKm / distanceKm, 2.0)
			: 1.0;
		float incidentScale = referenceSpectralIncidentScale * falloff;
		float sourceScale = localSpectralScale(incidentScale, channelIndex);
		float sourceT = localSourceTransmittance(
			samplePosition,
			sourceDirection,
			sourceDistance,
			wavelengthMicrometersValue
		);
		float transmittance = viewT * sourceT;
		float nu = clamp(dot(direction, sourceDirection), -1.0, 1.0);
		float weight = sampleIndex == 0 || sampleIndex == VIEW_SAMPLES
			? 0.5
			: 1.0;
		float sourceIrradiance = SOLAR_IRRADIANCE[channelIndex] * sourceScale;
		rayleighSum +=
			transmittance *
			density.x *
			sourceIrradiance *
			rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighPhaseFunction(nu) *
			weight;
		mieSum +=
			transmittance *
			density.y *
			sourceIrradiance *
			mieScatteringCoefficientAt(wavelengthMicrometersValue) *
			miePhaseFunction(MIE_PHASE_G, nu) *
			weight;
		previousDensity = density;
	}
	float viewTransmittance = transmittanceAt(
		cumulativeRayleigh,
		cumulativeMie,
		wavelengthMicrometersValue
	);
	return vec2((rayleighSum + mieSum) * stepSize, viewTransmittance);
}

vec3 localIncidentDirectionToSourceFrame(vec3 position, vec3 worldDirection) {
	vec2 delta = position.xy - localSourcePosition.xy;
	float rho = length(delta);
	vec3 radial = rho == 0.0
		? vec3(1.0, 0.0, 0.0)
		: vec3(delta.x / rho, delta.y / rho, 0.0);
	vec3 tangential = vec3(-radial.y, radial.x, 0.0);
	return normalize(vec3(
		dot(worldDirection, radial),
		dot(worldDirection, tangential),
		worldDirection.z
	));
}

int nearestLocalIncidentZBin(float zMeters) {
	int bestIndex = 0;
	float bestDelta = abs(zMeters - localIncidentZBins[0]);
	for (int index = 1; index < MAX_LOCAL_CACHE_Z_BINS; index++) {
		if (index >= localIncidentZBinCount) {
			break;
		}
		float delta = abs(zMeters - localIncidentZBins[index]);
		if (delta < bestDelta) {
			bestDelta = delta;
			bestIndex = index;
		}
	}
	return bestIndex;
}

int nearestLocalIncidentRhoBin(float rhoMeters) {
	int bestIndex = 0;
	float bestDelta = abs(rhoMeters - localIncidentRhoBins[0]);
	for (int index = 1; index < MAX_LOCAL_CACHE_RHO_BINS; index++) {
		if (index >= localIncidentRhoBinCount) {
			break;
		}
		float delta = abs(rhoMeters - localIncidentRhoBins[index]);
		if (delta < bestDelta) {
			bestDelta = delta;
			bestIndex = index;
		}
	}
	return bestIndex;
}

int nearestLocalIncidentDirectionBin(vec3 localDirection) {
	int bestIndex = 0;
	float bestDot = -2.0;
	for (int index = 0; index < MAX_LOCAL_CACHE_DIRECTION_BINS; index++) {
		if (index >= localIncidentDirectionCount) {
			break;
		}
		float score = dot(localIncidentDirections[index], localDirection);
		if (score > bestDot) {
			bestDot = score;
			bestIndex = index;
		}
	}
	return bestIndex;
}

float packedComponent(vec4 value, int componentIndex) {
	if (componentIndex == 0) {
		return value.r;
	}
	if (componentIndex == 1) {
		return value.g;
	}
	if (componentIndex == 2) {
		return value.b;
	}
	return value.a;
}

float sampleLocalIncidentCache(
	vec3 position,
	vec3 incomingDirection,
	int channelIndex
) {
	if (
		localIncidentCacheAvailable == 0 ||
		localIncidentZBinCount <= 0 ||
		localIncidentRhoBinCount <= 0 ||
		localIncidentDirectionCount <= 0 ||
		localIncidentSpectralGroupCount <= 0
	) {
		return 0.0;
	}
	float rhoMeters = length(position.xy - localSourcePosition.xy);
	if (rhoMeters > localIncidentRhoBins[localIncidentRhoBinCount - 1]) {
		return 0.0;
	}
	int zIndex = nearestLocalIncidentZBin(clamp(position.z, 0.0, topAltitudeMeters));
	int rhoIndex = nearestLocalIncidentRhoBin(rhoMeters);
	vec3 localDirection = localIncidentDirectionToSourceFrame(
		position,
		incomingDirection
	);
	int directionIndex = nearestLocalIncidentDirectionBin(localDirection);
	int groupIndex = channelIndex / 4;
	int componentIndex = channelIndex - groupIndex * 4;
	int layerIndex =
		directionIndex * localIncidentSpectralGroupCount + groupIndex;
	vec3 texCoord = vec3(
		(float(rhoIndex) + 0.5) / max(1.0, localIncidentCacheDimensions.x),
		(float(zIndex) + 0.5) / max(1.0, localIncidentCacheDimensions.y),
		(float(layerIndex) + 0.5) / max(1.0, localIncidentCacheDimensions.z)
	);
	return packedComponent(texture(localIncidentCacheTexture, texCoord), componentIndex);
}

vec3 localSecondOrderIncomingDirection(int directionIndex, vec3 sourceDirection) {
	int centeredIndex = directionIndex - 8;
	float index = float(centeredIndex);
	float count = float(LOCAL_SECOND_ORDER_INCOMING_DIRECTIONS);
	float goldenRatio = (1.0 + sqrt(5.0)) / 2.0;
	vec3 sunAxis = normalize(sourceDirection);
	vec3 reference = abs(dot(sunAxis, vec3(0.0, 0.0, 1.0))) < 0.95
		? vec3(0.0, 0.0, 1.0)
		: vec3(0.0, 1.0, 0.0);
	vec3 zAxis = normalize(reference - sunAxis * dot(reference, sunAxis));
	vec3 yAxis = normalize(cross(zAxis, sunAxis));
	float localZ = clamp((2.0 * index) / count, -1.0, 1.0);
	float latitude = asin(localZ);
	float longitude = (2.0 * PI * index) / goldenRatio;
	float horizontalScale = cos(latitude);
	float localX = horizontalScale * cos(longitude);
	float localY = horizontalScale * sin(longitude);
	return normalize(sunAxis * localX + yAxis * localY + zAxis * localZ);
}

float localSecondOrderAtSample(
	vec3 samplePosition,
	vec3 viewRay,
	vec2 density,
	float viewTransmittance,
	int channelIndex,
	float wavelengthMicrometersValue,
	vec3 sourceDirectionAtOrigin
) {
	float sum = 0.0;
	float angularWeight =
		(4.0 * PI) / float(LOCAL_SECOND_ORDER_INCOMING_DIRECTIONS);
	for (int index = 0; index < LOCAL_SECOND_ORDER_INCOMING_DIRECTIONS; index++) {
		vec3 incomingDirection =
			localSecondOrderIncomingDirection(index, sourceDirectionAtOrigin);
		float incidentRadiance = sampleLocalIncidentCache(
			samplePosition,
			incomingDirection,
			channelIndex
		);
		float nu = clamp(dot(viewRay, incomingDirection), -1.0, 1.0);
		float scatteringCoefficient =
			density.x *
				rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
				rayleighPhaseFunction(nu) +
			density.y *
				mieScatteringCoefficientAt(wavelengthMicrometersValue) *
				miePhaseFunction(MIE_PHASE_G, nu);
		sum +=
			viewTransmittance *
			incidentRadiance *
			scatteringCoefficient *
			angularWeight;
	}
	return sum;
}

vec2 localFirstPlusSecondOrderPathAndViewT(
	vec3 origin,
	vec3 direction,
	float distanceMeters,
	int channelIndex
) {
	if (distanceMeters <= 0.0) {
		return vec2(0.0, 1.0);
	}
	float wavelengthNm = WAVELENGTHS_NM[channelIndex];
	float wavelengthMicrometersValue = wavelengthNm * 0.001;
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	vec2 previousDensity = flatDensityAt(origin);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;
	float secondOrderSum = 0.0;
	vec3 vectorToSourceAtOrigin = localSourcePosition - origin;
	float distanceToSourceAtOrigin = length(vectorToSourceAtOrigin);
	vec3 sourceDirectionAtOrigin = distanceToSourceAtOrigin == 0.0
		? vec3(0.0, 0.0, 1.0)
		: vectorToSourceAtOrigin / distanceToSourceAtOrigin;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = flatDensityAt(samplePosition);
		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousDensity.x + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousDensity.y + density.y) * stepSize;
		}
		float viewT = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie,
			wavelengthMicrometersValue
		);
		vec3 vectorToSource = localSourcePosition - samplePosition;
		float sourceDistance = length(vectorToSource);
		vec3 sourceDirection = sourceDistance == 0.0
			? vec3(0.0, 0.0, 1.0)
			: vectorToSource / sourceDistance;
		float distanceKm = sourceDistance / 1000.0;
		float falloff = distanceFalloff == 1
			? pow(referenceDistanceKm / distanceKm, 2.0)
			: 1.0;
		float incidentScale = referenceSpectralIncidentScale * falloff;
		float sourceScale = localSpectralScale(incidentScale, channelIndex);
		float sourceT = localSourceTransmittance(
			samplePosition,
			sourceDirection,
			sourceDistance,
			wavelengthMicrometersValue
		);
		float transmittance = viewT * sourceT;
		float nu = clamp(dot(direction, sourceDirection), -1.0, 1.0);
		float weight = sampleIndex == 0 || sampleIndex == VIEW_SAMPLES
			? 0.5
			: 1.0;
		float sourceIrradiance = SOLAR_IRRADIANCE[channelIndex] * sourceScale;
		rayleighSum +=
			transmittance *
			density.x *
			sourceIrradiance *
			rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighPhaseFunction(nu) *
			weight;
		mieSum +=
			transmittance *
			density.y *
			sourceIrradiance *
			mieScatteringCoefficientAt(wavelengthMicrometersValue) *
			miePhaseFunction(MIE_PHASE_G, nu) *
			weight;
		secondOrderSum +=
			localSecondOrderAtSample(
				samplePosition,
				direction,
				density,
				viewT,
				channelIndex,
				wavelengthMicrometersValue,
				sourceDirectionAtOrigin
			) *
			weight;
		previousDensity = density;
	}
	float viewTransmittance = transmittanceAt(
		cumulativeRayleigh,
		cumulativeMie,
		wavelengthMicrometersValue
	);
	return vec2((rayleighSum + mieSum + secondOrderSum) * stepSize, viewTransmittance);
}

vec3 encodeDistanceRgb24(float distanceMeters) {
	float normalized = clamp(distanceMeters / maxDistanceMeters, 0.0, 1.0);
	float encoded = floor(normalized * 16777215.0 + 0.5);
	float r = floor(encoded / 65536.0);
	float g = floor((encoded - r * 65536.0) / 256.0);
	float b = encoded - r * 65536.0 - g * 256.0;
	return vec3(r, g, b) / 255.0;
}

float reconstructedWorldDistance(float depth) {
	vec2 ndc = (gl_FragCoord.xy / resolution) * 2.0 - 1.0;
	vec4 clip = vec4(ndc, depth * 2.0 - 1.0, 1.0);
	vec4 view = sourceProjectionMatrixInverse * clip;
	view /= view.w;
	vec4 world = sourceCameraMatrixWorld * view;
	return length(world.xyz - sourceCameraPosition);
}

vec3 reconstructedWorldRayDirection() {
	vec2 ndc = (gl_FragCoord.xy / resolution) * 2.0 - 1.0;
	vec4 clip = vec4(ndc, 1.0, 1.0);
	vec4 view = sourceProjectionMatrixInverse * clip;
	view /= view.w;
	vec4 world = sourceCameraMatrixWorld * view;
	return normalize(world.xyz - sourceCameraPosition);
}

vec3 threeToAlgorithmPosition(vec3 position) {
	return vec3(position.x, -position.z, BOTTOM_RADIUS_METERS + position.y);
}

vec3 threeToAlgorithmDirection(vec3 direction) {
	return normalize(vec3(direction.x, -direction.z, direction.y));
}

vec3 threeToFlatAlgorithmPosition(vec3 position) {
	return vec3(position.x, -position.z, position.y);
}

vec3 threeToFlatAlgorithmDirection(vec3 direction) {
	return normalize(vec3(direction.x, -direction.z, direction.y));
}

float distanceToFlatSkyBoundary(vec3 origin, vec3 direction) {
	float distance = sceneSkyRayLimitMeters;
	if (direction.z < 0.0) {
		float groundDistance = max(0.0, -origin.z / direction.z);
		distance = min(distance, groundDistance);
	}
	if (direction.z > 0.0) {
		float topDistance =
			max(0.0, (topAltitudeMeters - origin.z) / direction.z);
		distance = min(distance, topDistance);
	}
	return distance;
}

vec3 distantFirstOrderAtmosphere(vec2 pixelUv, bool hit, float hitDistanceMeters) {
	vec3 rayDirectionThree = reconstructedWorldRayDirection();
	float pixelSolidAngleSteradians =
		rayPixelSolidAngleSteradians(rayDirectionThree);
	vec3 algorithmOrigin = threeToAlgorithmPosition(sourceCameraPosition);
	vec3 algorithmDirection = threeToAlgorithmDirection(rayDirectionThree);
	float distanceMeters = hitDistanceMeters;

	if (!hit) {
		float radius = length(algorithmOrigin);
		float mu = dot(algorithmOrigin, algorithmDirection) / radius;
		distanceMeters = distanceToTopAtmosphereBoundary(radius, mu);
	}

	vec3 xyz = vec3(0.0);
	float blueTransmittanceSum = 0.0;
	float greenTransmittanceSum = 0.0;
	float redTransmittanceSum = 0.0;

	for (int channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex++) {
		float wavelengthNm = WAVELENGTHS_NM[channelIndex];
		float wavelengthMicrometers = wavelengthNm * 0.001;
		vec2 pathAndT = firstOrderPathAndViewT(
			algorithmOrigin,
			algorithmDirection,
			distanceMeters,
			wavelengthMicrometers,
			SOLAR_IRRADIANCE[channelIndex]
		);
		xyz += CIE[channelIndex] * pathAndT.x * SPECTRAL_DELTA_NM;
		if (channelIndex < 5) {
			blueTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 4 && channelIndex < 9) {
			greenTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 8) {
			redTransmittanceSum += pathAndT.y;
		}
	}

	vec3 skyLinearSrgb = xyzToDisplayLinearSrgb(xyz);
	vec3 displayRgb = toneMapDisplayLinearSrgb(skyLinearSrgb);
	vec3 transmittanceRgb = vec3(
		redTransmittanceSum / 7.0,
		greenTransmittanceSum / 5.0,
		blueTransmittanceSum / 5.0
	);
	if (debugViewMode == 1) {
		return transmittanceRgb;
	}
	if (debugViewMode == 2) {
		return displayRgb;
	}
	if (hit) {
		displayRgb = composeCapturedSceneEndpointProxy(
			pixelUv,
			skyLinearSrgb,
			transmittanceRgb
		);
	} else {
		displayRgb = toneMapDisplayLinearSrgb(
			skyLinearSrgb + pointStarFieldLinearSrgb(
				rayDirectionThree,
				transmittanceRgb,
				pixelSolidAngleSteradians
			)
		);
	}
	return displayRgb;
}

vec3 localFirstOrderAtmosphere(vec2 pixelUv, bool hit, float hitDistanceMeters) {
	vec3 rayDirectionThree = reconstructedWorldRayDirection();
	float pixelSolidAngleSteradians =
		rayPixelSolidAngleSteradians(rayDirectionThree);
	vec3 algorithmOrigin = threeToFlatAlgorithmPosition(sourceCameraPosition);
	vec3 algorithmDirection = threeToFlatAlgorithmDirection(rayDirectionThree);
	if (debugViewMode == 3) {
		return algorithmDirection * 0.5 + 0.5;
	}
	if (debugViewMode == 4) {
		return normalize(localSourcePosition - algorithmOrigin) * 0.5 + 0.5;
	}
	float distanceMeters = hit
		? hitDistanceMeters
		: distanceToFlatSkyBoundary(algorithmOrigin, algorithmDirection);

	vec3 xyz = vec3(0.0);
	float blueTransmittanceSum = 0.0;
	float greenTransmittanceSum = 0.0;
	float redTransmittanceSum = 0.0;

	for (int channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex++) {
		vec2 pathAndT = localFirstOrderPathAndViewT(
			algorithmOrigin,
			algorithmDirection,
			distanceMeters,
			channelIndex
		);
		xyz += CIE[channelIndex] * pathAndT.x * SPECTRAL_DELTA_NM;
		if (channelIndex < 5) {
			blueTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 4 && channelIndex < 9) {
			greenTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 8) {
			redTransmittanceSum += pathAndT.y;
		}
	}

	vec3 skyLinearSrgb = xyzToDisplayLinearSrgb(xyz);
	vec3 displayRgb = toneMapDisplayLinearSrgb(skyLinearSrgb);
	vec3 transmittanceRgb = vec3(
		redTransmittanceSum / 7.0,
		greenTransmittanceSum / 5.0,
		blueTransmittanceSum / 5.0
	);
	if (debugViewMode == 1) {
		return transmittanceRgb;
	}
	if (debugViewMode == 2) {
		return displayRgb;
	}
	if (hit) {
		displayRgb = composeCapturedSceneEndpointProxy(
			pixelUv,
			skyLinearSrgb,
			transmittanceRgb
		);
	} else {
		displayRgb = toneMapDisplayLinearSrgb(
			skyLinearSrgb + pointStarFieldLinearSrgb(
				rayDirectionThree,
				transmittanceRgb,
				pixelSolidAngleSteradians
			)
		);
	}
	return displayRgb;
}

vec3 localSecondOrderAtmosphere(vec2 pixelUv, bool hit, float hitDistanceMeters) {
	vec3 rayDirectionThree = reconstructedWorldRayDirection();
	float pixelSolidAngleSteradians =
		rayPixelSolidAngleSteradians(rayDirectionThree);
	vec3 algorithmOrigin = threeToFlatAlgorithmPosition(sourceCameraPosition);
	vec3 algorithmDirection = threeToFlatAlgorithmDirection(rayDirectionThree);
	if (debugViewMode == 3) {
		return algorithmDirection * 0.5 + 0.5;
	}
	if (debugViewMode == 4) {
		return normalize(localSourcePosition - algorithmOrigin) * 0.5 + 0.5;
	}
	float distanceMeters = hit
		? hitDistanceMeters
		: distanceToFlatSkyBoundary(algorithmOrigin, algorithmDirection);

	vec3 xyz = vec3(0.0);
	float blueTransmittanceSum = 0.0;
	float greenTransmittanceSum = 0.0;
	float redTransmittanceSum = 0.0;

	for (int channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex++) {
		vec2 pathAndT = localFirstPlusSecondOrderPathAndViewT(
			algorithmOrigin,
			algorithmDirection,
			distanceMeters,
			channelIndex
		);
		xyz += CIE[channelIndex] * pathAndT.x * SPECTRAL_DELTA_NM;
		if (channelIndex < 5) {
			blueTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 4 && channelIndex < 9) {
			greenTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 8) {
			redTransmittanceSum += pathAndT.y;
		}
	}

	vec3 skyLinearSrgb = xyzToDisplayLinearSrgb(xyz);
	vec3 displayRgb = toneMapDisplayLinearSrgb(skyLinearSrgb);
	vec3 transmittanceRgb = vec3(
		redTransmittanceSum / 7.0,
		greenTransmittanceSum / 5.0,
		blueTransmittanceSum / 5.0
	);
	if (debugViewMode == 1) {
		return transmittanceRgb;
	}
	if (debugViewMode == 2) {
		return displayRgb;
	}
	if (hit) {
		displayRgb = composeCapturedSceneEndpointProxy(
			pixelUv,
			skyLinearSrgb,
			transmittanceRgb
		);
	} else {
		displayRgb = toneMapDisplayLinearSrgb(
			skyLinearSrgb + pointStarFieldLinearSrgb(
				rayDirectionThree,
				transmittanceRgb,
				pixelSolidAngleSteradians
			)
		);
	}
	return displayRgb;
}

void main() {
	vec2 pixelUv = gl_FragCoord.xy / resolution;
	if (passMode == 0) {
		vec4 sceneColor = texture(sceneColorTexture, pixelUv);
		outColor = vec4(linearToSrgb(sceneColor.rgb), sceneColor.a);
		return;
	}

	float depth = texture(sceneDepthTexture, pixelUv).x;
	if (passMode == 2) {
		bool hit = depth < 0.999999;
		float distanceMeters = hit ? reconstructedWorldDistance(depth) : 0.0;
		outColor = vec4(
			distantFirstOrderAtmosphere(pixelUv, hit, distanceMeters),
			1.0
		);
		return;
	}
	if (passMode == 3) {
		bool hit = depth < 0.999999;
		float distanceMeters = hit ? reconstructedWorldDistance(depth) : 0.0;
		outColor = vec4(
			localFirstOrderAtmosphere(pixelUv, hit, distanceMeters),
			1.0
		);
		return;
	}
	if (passMode == 4) {
		bool hit = depth < 0.999999;
		float distanceMeters = hit ? reconstructedWorldDistance(depth) : 0.0;
		if (localIncidentCacheAvailable == 0) {
			outColor = vec4(1.0, 0.0, 1.0, 1.0);
			return;
		}
		outColor = vec4(
			localSecondOrderAtmosphere(pixelUv, hit, distanceMeters),
			1.0
		);
		return;
	}

	if (depth >= 0.999999) {
		outColor = vec4(1.0, 0.0, 1.0, 1.0);
		return;
	}

	outColor = vec4(encodeDistanceRgb24(reconstructedWorldDistance(depth)), 1.0);
}
`,
		});
	}

	setConfig(config) {
		this.config = config || {};
	}

	setSize(width, height) {
		if (this.width === width && this.height === height) {
			return;
		}
		this.width = width;
		this.height = height;
		this.sceneRenderTarget.setSize(width, height);
		this.material.uniforms.resolution.value.set(width, height);
	}

	updateCameraUniforms(camera) {
		camera.updateMatrixWorld(true);
		camera.updateProjectionMatrix();
		this.material.uniforms.sourceProjectionMatrixInverse.value.copy(
			camera.projectionMatrixInverse
		);
		this.material.uniforms.sourceCameraMatrixWorld.value.copy(
			camera.matrixWorld
		);
		this.material.uniforms.sourceCameraPosition.value.copy(camera.position);
	}

	renderScene(scene, camera) {
		const originalTarget = this.renderer.getRenderTarget();
		this.renderer.setRenderTarget(this.sceneRenderTarget);
		this.renderer.clear(true, true, true);
		this.renderer.render(scene, camera);
		this.renderer.setRenderTarget(originalTarget);
	}

	render({ camera }) {
		this.updateCameraUniforms(camera);
		this.material.uniforms.passMode.value = threeNativePassModeCode(this.mode);
		this.material.uniforms.maxDistanceMeters.value = this.maxDistanceMeters;
		this.material.uniforms.resolution.value.set(this.width, this.height);
		this.material.uniforms.sunRayAlgorithm.value.fromArray(
			sourceSunDirectionForPassConfig(this.config)
		);
		this.material.uniforms.localSourcePosition.value.fromArray(
			localSourcePositionForPassConfig(this.config)
		);
		updateLocalIncidentCacheUniforms(this.material.uniforms, this.config);
		this.material.uniforms.topAltitudeMeters.value =
			this.config?.geometry?.topAltitudeMeters ?? 100000;
		this.material.uniforms.sceneSkyRayLimitMeters.value =
			this.config?.geometry?.sceneSkyRayLimitMeters ?? 1926774;
		this.material.uniforms.referenceDistanceKm.value =
			this.config?.source?.referenceDistanceKm ?? 4800;
		this.material.uniforms.referenceSpectralIncidentScale.value =
			this.config?.source?.referenceSpectralIncidentScale ?? 1;
		this.material.uniforms.distanceFalloff.value =
			this.config?.source?.distanceFalloff === false ? 0 : 1;
		this.material.uniforms.sourceColor.value.set(
			this.config?.source?.color?.r ?? 1,
			this.config?.source?.color?.g ?? 0.98,
			this.config?.source?.color?.b ?? 0.95
		);
		this.material.uniforms.debugViewMode.value = debugViewModeCode(
			this.config?.display?.debugView
		);
		this.material.uniforms.starFieldEnabled.value =
			starFieldEnabledForPassConfig(this.config);
		this.material.uniforms.starFieldIntensity.value =
			starFieldIntensityForPassConfig(this.config);
		this.material.uniforms.starFieldDensity.value =
			starFieldDensityForPassConfig(this.config);
		this.material.uniforms.starFieldPointSize.value =
			starFieldPointSizeForPassConfig(this.config);
		const originalTarget = this.renderer.getRenderTarget();
		this.renderer.setRenderTarget(null);
		this.renderer.clear(true, true, true);
		this.renderer.render(this.passScene, this.passCamera);
		this.renderer.setRenderTarget(originalTarget);
	}

	readSceneColorTargetTopLeft() {
		return readRenderTargetRgbaTopLeft(
			this.renderer,
			this.sceneRenderTarget,
			this.width,
			this.height
		);
	}

	dispose() {
		this.fullscreenQuad.geometry.dispose();
		this.material.dispose();
		this.sceneRenderTarget.dispose();
	}
}

function readRenderTargetRgbaTopLeft(renderer, renderTarget, width, height) {
	const bottomLeft = new Uint8Array(width * height * 4);
	const topLeft = new Uint8Array(width * height * 4);
	renderer.readRenderTargetPixels(
		renderTarget,
		0,
		0,
		width,
		height,
		bottomLeft
	);

	for (let y = 0; y < height; y += 1) {
		const sourceY = height - y - 1;
		for (let x = 0; x < width; x += 1) {
			const sourceOffset = (sourceY * width + x) * 4;
			const targetOffset = (y * width + x) * 4;
			topLeft[targetOffset] = bottomLeft[sourceOffset];
			topLeft[targetOffset + 1] = bottomLeft[sourceOffset + 1];
			topLeft[targetOffset + 2] = bottomLeft[sourceOffset + 2];
			topLeft[targetOffset + 3] = bottomLeft[sourceOffset + 3];
		}
	}

	return topLeft;
}


export { threeNativePassModeCode, debugViewModeCode, sourceSunDirectionForPassConfig, localSourcePositionForPassConfig };

function threeNativePassModeCode(mode) {
	if (mode === 'depth-distance') {
		return 1;
	}
	if (mode === 'distant-first-order-atmosphere') {
		return 2;
	}
	if (mode === 'flat-local-first-order-atmosphere') {
		return 3;
	}
	if (mode === 'flat-local-second-order-atmosphere') {
		return 4;
	}
	return 0;
}

function debugViewModeCode(debugView) {
	if (debugView === 'transmittance') {
		return 1;
	}
	if (debugView === 'path-radiance') {
		return 2;
	}
	if (debugView === 'flat-ray-direction') {
		return 3;
	}
	if (debugView === 'flat-source-direction') {
		return 4;
	}
	return 0;
}

function starFieldEnabledForPassConfig(config) {
	return config?.display?.starField?.enabled === true ? 1 : 0;
}

function starFieldIntensityForPassConfig(config) {
	return finiteOrDefault(config?.display?.starField?.intensity, 1);
}

function starFieldDensityForPassConfig(config) {
	return finiteOrDefault(config?.display?.starField?.density, 1);
}

function starFieldPointSizeForPassConfig(config) {
	return finiteOrDefault(config?.display?.starField?.pointSize, 1);
}

function finiteOrDefault(value, fallback) {
	const number = Number(value);
	return Number.isFinite(number) ? number : fallback;
}

function sourceSunDirectionForPassConfig(config) {
	const source = config?.source;
	if (source?.kind === 'distant-directional-sun' && source.sunDirection) {
		return source.sunDirection;
	}
	return [0, 0, 1];
}

function localSourcePositionForPassConfig(config) {
	const source = config?.source;
	if (source?.kind === 'flat-local-point-sun' && source.positionMeters) {
		return source.positionMeters;
	}
	return [0, 0, 1];
}

function localIncidentCacheTextureForPassConfig(config) {
	return config?.localIncidentCache?.texture || null;
}

function localIncidentCacheAvailableForPassConfig(config) {
	return config?.localIncidentCache?.texture ? 1 : 0;
}

function localIncidentCacheDimensionsForPassConfig(config) {
	const cache = config?.localIncidentCache;
	return [
		cache?.width || 1,
		cache?.height || 1,
		cache?.depth || 1,
	];
}

function localIncidentZBinsForPassConfig(config) {
	return paddedFloatUniform(config?.localIncidentCache?.zMeters, 8);
}

function localIncidentRhoBinsForPassConfig(config) {
	return paddedFloatUniform(config?.localIncidentCache?.rhoMeters, 8);
}

function localIncidentDirectionsForPassConfig(config) {
	const directions = Array.isArray(config?.localIncidentCache?.incomingDirections)
		? config.localIncidentCache.incomingDirections
		: [];
	const values = [];
	for (let index = 0; index < 16; index += 1) {
		const direction = directions[index] || [0, 0, 1];
		values.push(new THREE.Vector3(direction[0], direction[1], direction[2]));
	}
	return {
		count: Math.min(directions.length, 16),
		values,
	};
}

function localIncidentSpectralGroupCountForPassConfig(config) {
	return config?.localIncidentCache?.spectralGroupCount || 4;
}

function paddedFloatUniform(values, capacity) {
	const sourceValues = Array.isArray(values) ? values : [];
	const padded = new Array(capacity).fill(0);
	for (let index = 0; index < Math.min(sourceValues.length, capacity); index += 1) {
		padded[index] = sourceValues[index];
	}
	return {
		count: Math.min(sourceValues.length, capacity),
		values: padded,
	};
}

function updateLocalIncidentCacheUniforms(uniforms, config) {
	const zBins = localIncidentZBinsForPassConfig(config);
	const rhoBins = localIncidentRhoBinsForPassConfig(config);
	const directions = localIncidentDirectionsForPassConfig(config);
	uniforms.localIncidentCacheTexture.value =
		localIncidentCacheTextureForPassConfig(config);
	uniforms.localIncidentCacheAvailable.value =
		localIncidentCacheAvailableForPassConfig(config);
	uniforms.localIncidentCacheDimensions.value.fromArray(
		localIncidentCacheDimensionsForPassConfig(config)
	);
	uniforms.localIncidentZBinCount.value = zBins.count;
	uniforms.localIncidentRhoBinCount.value = rhoBins.count;
	uniforms.localIncidentDirectionCount.value = directions.count;
	uniforms.localIncidentSpectralGroupCount.value =
		localIncidentSpectralGroupCountForPassConfig(config);
	for (let index = 0; index < zBins.values.length; index += 1) {
		uniforms.localIncidentZBins.value[index] = zBins.values[index];
	}
	for (let index = 0; index < rhoBins.values.length; index += 1) {
		uniforms.localIncidentRhoBins.value[index] = rhoBins.values[index];
	}
	for (let index = 0; index < directions.values.length; index += 1) {
		uniforms.localIncidentDirections.value[index].copy(directions.values[index]);
	}
}
