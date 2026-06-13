import React, { useEffect, useMemo } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { resolveAnimatedSun } from '../models/sun-animation.js';
import { createAtmosphereUniformAdapter } from './atmosphere-uniforms.js';

const FULLSCREEN_VERTEX_SHADER = `
	varying vec2 vUv;

	void main() {
		vUv = uv;
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

const COMPOSITION_FRAGMENT_SHADER = `
	const int VIEW_STEPS = 16;
	const int LIGHT_STEPS = 8;
	const float PI = 3.141592653589793;
	const float EPSILON = 0.000001;

	uniform sampler2D sceneColorTexture;
	uniform sampler2D sceneDepthTexture;
	uniform vec2 viewportResolution;
	uniform mat4 cameraProjectionMatrixInverse;
	uniform mat4 cameraViewMatrixInverse;
	uniform float cameraNearKm;
	uniform float cameraFarKm;
	uniform vec3 cameraWorldPosition;
	uniform float atmosphereMaxViewDistanceKm;
	uniform float atmosphereTopAltitudeKm;
	uniform float atmosphereRayleighScaleHeightKm;
	uniform float atmosphereAerosolScaleHeightKm;
	uniform vec3 atmosphereRayleighBetaKm;
	uniform vec3 atmosphereMieBetaKm;
	uniform float atmosphereMieAnisotropy;
	uniform vec3 atmosphereAirlightRgb;
	uniform float atmosphereMaxAirlight;
	uniform vec3 atmosphereFrameOrigin;
	uniform vec3 atmosphereFrameUp;
	uniform float sunKindId;
	uniform vec3 sunDirection;
	uniform vec3 sunPosition;
	uniform vec3 sunColor;
	uniform float sunIntensity;
	uniform float atmosphereShellExposure;
	uniform float atmosphereSolidScatteringSourceGain;
	uniform float atmosphereSkyScatteringSourceGain;
	uniform float atmosphereSkyLightTransmittanceFloor;
	uniform float atmosphereBackgroundDebugModeId;
	uniform float atmosphereBackgroundDebugScale;

	varying vec2 vUv;

	float altitudeKm(vec3 position) {
		return dot(position - atmosphereFrameOrigin, normalize(atmosphereFrameUp));
	}

	float relativeDensity(float altitude, float scaleHeight) {
		if (altitude < 0.0 || altitude > atmosphereTopAltitudeKm) {
			return 0.0;
		}

		return exp(-altitude / scaleHeight);
	}

	vec3 extinctionAtAltitude(float altitude) {
		float rayleigh = relativeDensity(altitude, atmosphereRayleighScaleHeightKm);
		float aerosol = relativeDensity(altitude, atmosphereAerosolScaleHeightKm);

		return atmosphereRayleighBetaKm * rayleigh + atmosphereMieBetaKm * aerosol;
	}

	float atmosphereExitDistance(vec3 origin, vec3 direction, float fallbackDistance) {
		float currentAltitude = altitudeKm(origin);
		float vertical = dot(direction, normalize(atmosphereFrameUp));

		if (abs(vertical) < EPSILON) {
			return fallbackDistance;
		}

		float boundaryAltitude = vertical > 0.0 ? atmosphereTopAltitudeKm : 0.0;
		float distance = (boundaryAltitude - currentAltitude) / vertical;

		if (distance <= 0.0) {
			return fallbackDistance;
		}

		return min(distance, fallbackDistance);
	}

	float resolvedViewDistance(float sceneDistance, bool hasSolidDepth, vec3 viewDirection) {
		float maxDistance = max(atmosphereMaxViewDistanceKm, atmosphereTopAltitudeKm);
		float rawDistance = hasSolidDepth
			? sceneDistance
			: atmosphereExitDistance(cameraWorldPosition, viewDirection, maxDistance);

		return clamp(rawDistance, 0.0, maxDistance);
	}

	float groundIntersectionDistance(vec3 origin, vec3 direction) {
		float currentAltitude = altitudeKm(origin);
		float vertical = dot(direction, normalize(atmosphereFrameUp));

		if (vertical >= -EPSILON) {
			return -1.0;
		}

		float distance = -currentAltitude / vertical;

		return distance > EPSILON ? distance : -1.0;
	}

	float rayleighPhase(float cosTheta) {
		return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
	}

	float miePhase(float cosTheta) {
		float g = clamp(atmosphereMieAnisotropy, -0.99, 0.99);
		float denominator = pow(max(1.0 + g * g - 2.0 * g * cosTheta, EPSILON), 1.5);

		return (1.0 - g * g) / (4.0 * PI * denominator);
	}

	bool isFiniteFloat(float value) {
		return value == value && abs(value) < 100000000000000000000.0;
	}

	bool isFiniteVec3(vec3 value) {
		return (
			isFiniteFloat(value.r)
			&& isFiniteFloat(value.g)
			&& isFiniteFloat(value.b)
		);
	}

	float finiteOrZero(float value) {
		return isFiniteFloat(value) ? value : 0.0;
	}

	vec3 finiteOrZero(vec3 value) {
		return vec3(
			finiteOrZero(value.r),
			finiteOrZero(value.g),
			finiteOrZero(value.b)
		);
	}

	vec3 safeNormalize(vec3 value, vec3 fallback) {
		float size = length(value);

		if (size < EPSILON || !isFiniteFloat(size)) {
			return fallback;
		}

		return value / size;
	}

	vec3 transmittanceForPath(vec3 origin, vec3 direction, float distance) {
		float stepDistance = distance / float(LIGHT_STEPS);
		vec3 opticalDepth = vec3(0.0);

		for (int index = 0; index < LIGHT_STEPS; index += 1) {
			float sampleDistance = (float(index) + 0.5) * stepDistance;
			vec3 samplePosition = origin + direction * sampleDistance;
			float altitude = altitudeKm(samplePosition);

			opticalDepth += extinctionAtAltitude(altitude) * stepDistance;
		}

		return exp(-opticalDepth);
	}

	vec3 reconstructWorldPosition(vec2 uv, float depth) {
		vec4 clipPosition = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
		vec4 viewPosition = cameraProjectionMatrixInverse * clipPosition;

		viewPosition /= viewPosition.w;

		vec4 worldPosition = cameraViewMatrixInverse * viewPosition;

		return worldPosition.xyz;
	}

	vec3 emergencySkyFloor(vec3 viewDirection) {
		vec3 lightDirection = sunKindId > 0.5
			? normalize(sunPosition - cameraWorldPosition)
			: normalize(sunDirection);
		float sunLift = clamp(dot(lightDirection, normalize(atmosphereFrameUp)) * 0.5 + 0.5, 0.0, 1.0);
		float viewLift = clamp(dot(viewDirection, normalize(atmosphereFrameUp)) * 0.5 + 0.5, 0.0, 1.0);
		vec3 horizonColor = vec3(0.008, 0.012, 0.018);
		vec3 zenithColor = vec3(0.002, 0.004, 0.010);
		vec3 skyColor = mix(horizonColor, zenithColor, viewLift);

		return skyColor * mix(0.55, 1.0, sunLift);
	}

	vec3 segmentAirlight(vec3 transmittance) {
		float averageTransmittance = (transmittance.r + transmittance.g + transmittance.b) / 3.0;
		float airlight = clamp(
			(1.0 - averageTransmittance) * atmosphereMaxAirlight,
			0.0,
			atmosphereMaxAirlight
		);

		return atmosphereAirlightRgb * airlight;
	}

	void main() {
		vec4 sceneColor = texture2D(sceneColorTexture, vUv);
		float sceneDepth = texture2D(sceneDepthTexture, vUv).x;
		bool hasSolidDepth = sceneDepth < 0.999999;
		vec3 worldPosition = reconstructWorldPosition(
			vUv,
			hasSolidDepth ? sceneDepth : 1.0
		);
		vec3 viewDirection = normalize(worldPosition - cameraWorldPosition);
		float viewDistance = resolvedViewDistance(
			length(worldPosition - cameraWorldPosition),
			hasSolidDepth,
			viewDirection
		);
		float stepDistance = viewDistance / float(VIEW_STEPS);
		vec3 opticalDepth = vec3(0.0);
		vec3 inScatteredLight = vec3(0.0);
		vec3 unattenuatedScatteredLight = vec3(0.0);
		float unshadowedSamples = 0.0;
		float atmosphereSamples = 0.0;
		float densitySum = 0.0;
		float phaseSum = 0.0;
		float viewTransmittanceSum = 0.0;
		float lightTransmittanceSum = 0.0;
		vec3 scatteringSourceSum = vec3(0.0);
		float validAngleSamples = 0.0;
		float rayleighPhaseSum = 0.0;
		float miePhaseSum = 0.0;
		float sourceDensitySum = 0.0;
		float sourcePhaseSum = 0.0;
		vec3 sourceCoefficientLightSum = vec3(0.0);
		float validScatteringSamples = 0.0;

		for (int index = 0; index < VIEW_STEPS; index += 1) {
			float sampleDistance = (float(index) + 0.5) * stepDistance;
			vec3 samplePosition = cameraWorldPosition + viewDirection * sampleDistance;
			float altitude = altitudeKm(samplePosition);

			if (altitude < 0.0 || altitude > atmosphereTopAltitudeKm) {
				continue;
			}

			vec3 extinction = extinctionAtAltitude(altitude);
			vec3 viewTransmittance = exp(-(opticalDepth + extinction * stepDistance * 0.5));
			viewTransmittanceSum += (viewTransmittance.r + viewTransmittance.g + viewTransmittance.b) / 3.0;
			vec3 lightDirection = sunKindId > 0.5
				? safeNormalize(sunPosition - samplePosition, normalize(atmosphereFrameUp))
				: safeNormalize(sunDirection, normalize(atmosphereFrameUp));
			float lightDistance = sunKindId > 0.5
				? length(sunPosition - samplePosition)
				: atmosphereTopAltitudeKm * 20.0;
			float groundDistance = groundIntersectionDistance(samplePosition, lightDirection);
			float cosTheta = clamp(dot(viewDirection, lightDirection), -1.0, 1.0);
			float rayleighDensity = relativeDensity(altitude, atmosphereRayleighScaleHeightKm);
			float aerosolDensity = relativeDensity(altitude, atmosphereAerosolScaleHeightKm);
			float rayleighPhaseValue = rayleighPhase(cosTheta);
			float miePhaseValue = miePhase(cosTheta);
			float sourceGain = hasSolidDepth
				? atmosphereSolidScatteringSourceGain
				: atmosphereSkyScatteringSourceGain;
			bool hasValidAngle = (
				cosTheta == cosTheta
				&& rayleighPhaseValue == rayleighPhaseValue
				&& miePhaseValue == miePhaseValue
			);
			vec3 rayleigh = atmosphereRayleighBetaKm * rayleighDensity * rayleighPhaseValue;
			vec3 mie = atmosphereMieBetaKm * aerosolDensity * miePhaseValue;
			vec3 scattering = (rayleigh + mie) * sunColor * sunIntensity * sourceGain;
			vec3 safeScattering = finiteOrZero(scattering);
			bool hasValidScattering = hasValidAngle;

			atmosphereSamples += 1.0;
			densitySum += (rayleighDensity + aerosolDensity) * 0.5;
			phaseSum += (rayleighPhaseValue + miePhaseValue) * 0.5;
			if (hasValidAngle) {
				validAngleSamples += 1.0;
				rayleighPhaseSum += rayleighPhaseValue;
				miePhaseSum += miePhaseValue;
				sourceDensitySum += (rayleighDensity + aerosolDensity) * 0.5;
				sourcePhaseSum += (rayleighPhaseValue + miePhaseValue) * 0.5;
				sourceCoefficientLightSum += (atmosphereRayleighBetaKm + atmosphereMieBetaKm) * sunColor * sunIntensity;
			}
			if (hasValidScattering) {
				scatteringSourceSum += safeScattering;
				validScatteringSamples += 1.0;
			}

			if (hasValidScattering && (groundDistance < 0.0 || groundDistance > lightDistance)) {
				float lightPathDistance = min(
					atmosphereExitDistance(samplePosition, lightDirection, atmosphereTopAltitudeKm * 20.0),
					lightDistance
				);
				vec3 lightTransmittance = transmittanceForPath(samplePosition, lightDirection, lightPathDistance);
				if (!hasSolidDepth) {
					lightTransmittance = max(
						lightTransmittance,
						vec3(atmosphereSkyLightTransmittanceFloor)
					);
				}

				inScatteredLight += viewTransmittance * lightTransmittance * safeScattering * stepDistance;
				unattenuatedScatteredLight += viewTransmittance * safeScattering * stepDistance;
				unshadowedSamples += 1.0;
				lightTransmittanceSum += (lightTransmittance.r + lightTransmittance.g + lightTransmittance.b) / 3.0;
			}

			opticalDepth += extinction * stepDistance;
		}

		vec3 transmittance = exp(-opticalDepth);
		vec3 rawAirlight = segmentAirlight(transmittance) + (inScatteredLight * atmosphereShellExposure);
		vec3 airlight = clamp(
			rawAirlight,
			vec3(0.0),
			vec3(atmosphereMaxAirlight)
		);
		vec3 backgroundFloor = hasSolidDepth ? vec3(0.0) : emergencySkyFloor(viewDirection);
		vec3 finalColor = sceneColor.rgb * transmittance + airlight;

		if (!hasSolidDepth && atmosphereBackgroundDebugModeId > 0.5) {
			if (atmosphereBackgroundDebugModeId < 1.5) {
				finalColor = clamp(inScatteredLight * atmosphereBackgroundDebugScale, vec3(0.0), vec3(1.0));
			} else if (atmosphereBackgroundDebugModeId < 2.5) {
				float unshadowedRatio = unshadowedSamples / float(VIEW_STEPS);
				float averageLightTransmittance = unshadowedSamples > 0.0
					? lightTransmittanceSum / unshadowedSamples
					: 0.0;
				float scatteringStrength = clamp(length(inScatteredLight) * atmosphereBackgroundDebugScale, 0.0, 1.0);

				finalColor = vec3(unshadowedRatio, averageLightTransmittance, scatteringStrength);
			} else {
				finalColor = clamp(unattenuatedScatteredLight * atmosphereBackgroundDebugScale, vec3(0.0), vec3(1.0));
				if (atmosphereBackgroundDebugModeId > 3.5) {
					float atmosphereRatio = atmosphereSamples / float(VIEW_STEPS);
					float averageDensity = atmosphereSamples > 0.0
						? densitySum / atmosphereSamples
						: 0.0;
					float averagePhase = atmosphereSamples > 0.0
						? phaseSum / atmosphereSamples
						: 0.0;

					finalColor = vec3(
						atmosphereRatio,
						clamp(averageDensity, 0.0, 1.0),
						clamp(averagePhase * 8.0, 0.0, 1.0)
					);
					if (atmosphereBackgroundDebugModeId > 4.5) {
						float averageViewTransmittance = atmosphereSamples > 0.0
							? viewTransmittanceSum / atmosphereSamples
							: 0.0;
						float averageOpticalDepth = (
							opticalDepth.r
							+ opticalDepth.g
							+ opticalDepth.b
						) / 3.0;

						finalColor = vec3(
							clamp(viewDistance / atmosphereMaxViewDistanceKm, 0.0, 1.0),
							clamp(averageViewTransmittance, 0.0, 1.0),
							clamp(averageOpticalDepth / 8.0, 0.0, 1.0)
						);
						if (atmosphereBackgroundDebugModeId > 5.5) {
							vec3 averageScatteringSource = atmosphereSamples > 0.0
								? scatteringSourceSum / atmosphereSamples
								: vec3(0.0);

							finalColor = clamp(
								averageScatteringSource * atmosphereBackgroundDebugScale,
								vec3(0.0),
								vec3(1.0)
							);
							if (atmosphereBackgroundDebugModeId > 6.5) {
								vec3 coefficientStrength = atmosphereRayleighBetaKm + atmosphereMieBetaKm;

								finalColor = vec3(
									clamp(sunIntensity / 64.0, 0.0, 1.0),
									clamp(length(sunColor) / 1.75, 0.0, 1.0),
									clamp(length(coefficientStrength) * 24.0, 0.0, 1.0)
								);
								if (atmosphereBackgroundDebugModeId > 7.5) {
									float angleRatio = validAngleSamples / float(VIEW_STEPS);
									float averageRayleighPhase = validAngleSamples > 0.0
										? rayleighPhaseSum / validAngleSamples
										: 0.0;
									float averageMiePhase = validAngleSamples > 0.0
										? miePhaseSum / validAngleSamples
										: 0.0;

									finalColor = vec3(
										clamp(angleRatio, 0.0, 1.0),
										clamp(averageRayleighPhase * 8.0, 0.0, 1.0),
										clamp(averageMiePhase * 8.0, 0.0, 1.0)
									);
									if (atmosphereBackgroundDebugModeId > 8.5) {
										float validSourceRatio = validAngleSamples > 0.0
											? validAngleSamples / float(VIEW_STEPS)
											: 0.0;
										float averageSourceDensity = validAngleSamples > 0.0
											? sourceDensitySum / validAngleSamples
											: 0.0;
										float averageSourcePhase = validAngleSamples > 0.0
											? sourcePhaseSum / validAngleSamples
											: 0.0;
										vec3 averageCoefficientLight = validAngleSamples > 0.0
											? sourceCoefficientLightSum / validAngleSamples
											: vec3(0.0);

										finalColor = vec3(
											clamp(averageSourceDensity, 0.0, 1.0),
											clamp(averageSourcePhase * 8.0, 0.0, 1.0),
											clamp(length(averageCoefficientLight) * 4.0 * validSourceRatio, 0.0, 1.0)
										);
										if (atmosphereBackgroundDebugModeId > 9.5) {
											float validScatteringRatio = validScatteringSamples / float(VIEW_STEPS);
											float reconstructedSource = averageSourceDensity
												* averageSourcePhase
												* length(averageCoefficientLight);
											vec3 averageScatteringSource = validScatteringSamples > 0.0
												? scatteringSourceSum / validScatteringSamples
												: vec3(0.0);

											finalColor = vec3(
												clamp(validScatteringRatio, 0.0, 1.0),
												clamp(reconstructedSource * atmosphereBackgroundDebugScale, 0.0, 1.0),
												clamp(length(averageScatteringSource) * atmosphereBackgroundDebugScale, 0.0, 1.0)
											);
										}
									}
								}
							}
						}
					}
				}
			}
		}

		gl_FragColor = vec4(max(finalColor, backgroundFloor), sceneColor.a);
	}
`;

const BACKGROUND_DEBUG_MODE_IDS = Object.freeze({
	none: 0,
	scattering: 1,
	diagnostics: 2,
	'unattenuated-scattering': 3,
	'scattering-inputs': 4,
	'view-path': 5,
	'scattering-source': 6,
	'scattering-factors': 7,
	'scattering-angles': 8,
	'scattering-components': 9,
	'scattering-sanity': 10,
});

function backgroundDebugModeId(mode) {
	return BACKGROUND_DEBUG_MODE_IDS[mode] ?? BACKGROUND_DEBUG_MODE_IDS.none;
}

function createRenderTarget(width, height) {
	const target = new THREE.WebGLRenderTarget(width, height, {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBAFormat,
		type: THREE.UnsignedByteType,
		depthBuffer: true,
		stencilBuffer: false,
	});

	target.depthTexture = new THREE.DepthTexture(width, height);
	target.depthTexture.format = THREE.DepthFormat;
	target.depthTexture.type = THREE.UnsignedIntType;

	return target;
}
/**
 * Render solid scene contents into color/depth, then compose atmosphere over it.
 *
 * @param {{ scene: FalseSimulationScene | null | undefined, children: React.ReactNode }} props - Carry scene state and solid render contents.
 * @returns {React.ReactNode}
 */
export default function FalseAtmosphereComposer({ scene, children }) {
	const { camera, gl, size } = useThree();
	const observerPosition = scene?.observer?.position;
	const target = useMemo(() => createRenderTarget(
		Math.max(1, Math.floor(size.width)),
		Math.max(1, Math.floor(size.height)),
	), []);
	const solidScene = useMemo(() => {
		const nextScene = new THREE.Scene();

		nextScene.background = new THREE.Color('#060912');

		return nextScene;
	}, []);
	const adapter = useMemo(() => {
		const resolvedSun = resolveAnimatedSun(scene?.sun, 0, {
			observerPosition,
		});

		return createAtmosphereUniformAdapter(scene?.atmosphere, resolvedSun?.light || scene?.lighting?.sun);
	}, [scene?.atmosphere, scene?.lighting?.sun, scene?.sun, observerPosition]);
	const uniforms = useMemo(() => ({
		...adapter.uniforms,
		sceneColorTexture: { value: target.texture },
		sceneDepthTexture: { value: target.depthTexture },
		viewportResolution: { value: [size.width, size.height] },
		cameraProjectionMatrixInverse: { value: camera.projectionMatrixInverse },
		cameraViewMatrixInverse: { value: camera.matrixWorld },
		cameraNearKm: { value: camera.near },
		cameraFarKm: { value: camera.far },
		cameraWorldPosition: { value: [camera.position.x, camera.position.y, camera.position.z] },
		atmosphereMaxViewDistanceKm: { value: Math.max((scene?.atmosphere?.profile?.topAltitudeKm ?? 80) * 4, 1) },
		atmosphereShellExposure: { value: scene?.atmosphere?.rendering?.shellExposure ?? 36 },
		atmosphereSolidScatteringSourceGain: { value: scene?.atmosphere?.rendering?.solidScatteringSourceGain ?? 1 },
		atmosphereSkyScatteringSourceGain: { value: scene?.atmosphere?.rendering?.skyScatteringSourceGain ?? 1 },
		atmosphereSkyLightTransmittanceFloor: { value: scene?.atmosphere?.rendering?.skyLightTransmittanceFloor ?? 0 },
		atmosphereBackgroundDebugModeId: {
			value: backgroundDebugModeId(scene?.atmosphere?.rendering?.backgroundDebugMode),
		},
		atmosphereBackgroundDebugScale: { value: scene?.atmosphere?.rendering?.backgroundDebugScale ?? 500 },
	}), [
		adapter.uniforms,
		camera,
		scene?.atmosphere?.rendering?.backgroundDebugMode,
		scene?.atmosphere?.rendering?.backgroundDebugScale,
		scene?.atmosphere?.profile?.topAltitudeKm,
		scene?.atmosphere?.rendering?.skyLightTransmittanceFloor,
		scene?.atmosphere?.rendering?.skyScatteringSourceGain,
		scene?.atmosphere?.rendering?.solidScatteringSourceGain,
		scene?.atmosphere?.rendering?.shellExposure,
		size.height,
		size.width,
		target,
	]);

	useEffect(() => {
		target.setSize(
			Math.max(1, Math.floor(size.width)),
			Math.max(1, Math.floor(size.height)),
		);
		uniforms.viewportResolution.value[0] = size.width;
		uniforms.viewportResolution.value[1] = size.height;
	}, [size.height, size.width, target, uniforms]);

	useEffect(() => () => {
		target.dispose();
		target.depthTexture.dispose();
	}, [target]);

	useFrame(({ clock }) => {
		if (!adapter.enabled) {
			return;
		}

		const resolvedSun = resolveAnimatedSun(scene?.sun, clock.getElapsedTime(), {
			observerPosition,
		});

		adapter.updateSunUniforms(resolvedSun?.light || scene?.lighting?.sun);
		camera.updateMatrixWorld();
		camera.updateProjectionMatrix();
		uniforms.cameraProjectionMatrixInverse.value = camera.projectionMatrixInverse;
		uniforms.cameraViewMatrixInverse.value = camera.matrixWorld;
		uniforms.cameraNearKm.value = camera.near;
		uniforms.cameraFarKm.value = camera.far;
		uniforms.cameraWorldPosition.value[0] = camera.position.x;
		uniforms.cameraWorldPosition.value[1] = camera.position.y;
		uniforms.cameraWorldPosition.value[2] = camera.position.z;
		uniforms.atmosphereMaxViewDistanceKm.value = Math.max(
			(scene?.atmosphere?.profile?.topAltitudeKm ?? 80) * 4,
			1,
		);
		uniforms.atmosphereBackgroundDebugModeId.value = backgroundDebugModeId(
			scene?.atmosphere?.rendering?.backgroundDebugMode,
		);
		uniforms.atmosphereBackgroundDebugScale.value = scene?.atmosphere?.rendering?.backgroundDebugScale ?? 500;
		uniforms.atmosphereSolidScatteringSourceGain.value = scene?.atmosphere?.rendering?.solidScatteringSourceGain ?? 1;
		uniforms.atmosphereSkyScatteringSourceGain.value = scene?.atmosphere?.rendering?.skyScatteringSourceGain ?? 1;
		uniforms.atmosphereSkyLightTransmittanceFloor.value = scene?.atmosphere?.rendering?.skyLightTransmittanceFloor ?? 0;

		const previousRenderTarget = gl.getRenderTarget();
		gl.setRenderTarget(target);
		gl.clear(true, true, true);
		gl.render(solidScene, camera);
		gl.setRenderTarget(previousRenderTarget);
	});

	if (!adapter.enabled) {
		return <React.Fragment>{children}</React.Fragment>;
	}

	return (
		<React.Fragment>
			{createPortal(children, solidScene)}
			<mesh frustumCulled={false}>
				<planeGeometry args={[2, 2]} />
				<shaderMaterial
					vertexShader={FULLSCREEN_VERTEX_SHADER}
					fragmentShader={COMPOSITION_FRAGMENT_SHADER}
					uniforms={uniforms}
					depthWrite={false}
					depthTest={false}
					toneMapped={false}
				/>
			</mesh>
		</React.Fragment>
	);
}
