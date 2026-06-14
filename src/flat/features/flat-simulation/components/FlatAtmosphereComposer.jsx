import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { createPortal, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import FlatContext from '../../../common/FlatContext.js';
import { createAtmosphereUniformAdapter } from './atmosphere-uniforms.js';
import { resolveAnimatedAtmosphereSun } from '../models/sun-animation.js';

const FULLSCREEN_VERTEX_SHADER = `
	varying vec2 vUv;

	void main() {
		vUv = uv;
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

const COMPOSITION_FRAGMENT_SHADER = `
	const int VIEW_STEPS = 8;
	const int LIGHT_STEPS = 4;
	const float EPSILON = 0.000001;
	const float PI = 3.141592653589793;
	// Exact far-plane reconstruction is unstable with the current near/far ratio.
	const float BACKGROUND_RAY_DEPTH = 0.999;

	uniform sampler2D sceneColorTexture;
	uniform sampler2D sceneDepthTexture;
	uniform mat4 cameraProjectionMatrixInverse;
	uniform mat4 cameraViewMatrixInverse;
	uniform vec3 cameraWorldPosition;
	uniform float atmosphereMaxViewDistanceKm;
	uniform float backgroundAtmosphereViewDistanceKm;
	uniform float flatSlabHorizonViewDistanceFactor;
	uniform float atmosphereTopAltitudeKm;
	uniform float atmosphereRayleighScaleHeightKm;
	uniform float atmosphereAerosolScaleHeightKm;
	uniform vec3 atmosphereRayleighBetaKm;
	uniform vec3 atmosphereMieBetaKm;
	uniform vec3 atmosphereMieExtinctionBetaKm;
	uniform vec3 atmosphereMieScatteringBetaKm;
	uniform float atmosphereMieAnisotropy;
	uniform float atmosphereFrameKindId;
	uniform vec3 atmosphereFrameOrigin;
	uniform vec3 atmosphereFrameUp;
	uniform float sunKindId;
	uniform vec3 sunDirection;
	uniform vec3 sunPosition;
	uniform vec3 sunColor;
	uniform float sunIntensity;
	uniform float sunSolarIrradianceScale;
	uniform float falseSunRadianceReferenceDistanceKm;
	uniform float falseSunRadianceDistanceFalloff;
	uniform float sampleToSunTransmittanceModelId;
	uniform float sampleToSunTransmittanceSteps;
	uniform float atmosphereDebugModeId;

	varying vec2 vUv;

	vec3 safeNormalize(vec3 value, vec3 fallback) {
		float valueLength = length(value);

		if (valueLength <= EPSILON) {
			return fallback;
		}

		return value / valueLength;
	}

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

		return atmosphereRayleighBetaKm * rayleigh + atmosphereMieExtinctionBetaKm * aerosol;
	}

	vec3 rayleighScatteringAtAltitude(float altitude) {
		return atmosphereRayleighBetaKm * relativeDensity(
			altitude,
			atmosphereRayleighScaleHeightKm
		);
	}

	vec3 mieScatteringAtAltitude(float altitude) {
		return atmosphereMieScatteringBetaKm * relativeDensity(
			altitude,
			atmosphereAerosolScaleHeightKm
		);
	}

	vec3 verticalOpticalDepthAbove(float altitude) {
		float clampedAltitude = clamp(altitude, 0.0, atmosphereTopAltitudeKm);
		float rayleighColumn = atmosphereRayleighScaleHeightKm
			* exp(-clampedAltitude / atmosphereRayleighScaleHeightKm);
		float aerosolColumn = atmosphereAerosolScaleHeightKm
			* exp(-clampedAltitude / atmosphereAerosolScaleHeightKm);

		return atmosphereRayleighBetaKm * rayleighColumn
			+ atmosphereMieExtinctionBetaKm * aerosolColumn;
	}

	float rayleighPhase(float cosTheta) {
		float mu = clamp(cosTheta, -1.0, 1.0);

		return (3.0 / (16.0 * PI)) * (1.0 + mu * mu);
	}

	float miePhase(float cosTheta) {
		float mu = clamp(cosTheta, -1.0, 1.0);
		float g = clamp(atmosphereMieAnisotropy, -0.99, 0.99);
		float denominator = pow(max(
			1.0 + g * g - 2.0 * g * mu,
			EPSILON
		), 1.5);

		return (1.0 - g * g) / (4.0 * PI * denominator);
	}

	vec3 lightDirectionAt(vec3 position) {
		if (sunKindId > 0.5) {
			return safeNormalize(sunPosition - position, vec3(0.0, 1.0, 0.0));
		}

		return safeNormalize(sunDirection, vec3(0.0, 1.0, 0.0));
	}

	float groundIntersectionDistance(vec3 origin, vec3 direction) {
		vec3 up = normalize(atmosphereFrameUp);
		float vertical = dot(direction, up);

		if (abs(vertical) < EPSILON) {
			return -1.0;
		}

		float distance = dot(atmosphereFrameOrigin - origin, up) / vertical;

		if (distance <= EPSILON) {
			return -1.0;
		}

		return distance;
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

	float lightDistanceAt(vec3 position, vec3 lightDirection) {
		if (sunKindId > 0.5) {
			return length(sunPosition - position);
		}

		return atmosphereExitDistance(
			position,
			lightDirection,
			max(atmosphereMaxViewDistanceKm, atmosphereTopAltitudeKm)
		);
	}

	float lightVisibilityAt(vec3 position, vec3 lightDirection) {
		float lightDistance = lightDistanceAt(position, lightDirection);
		float groundDistance = groundIntersectionDistance(position, lightDirection);

		if (groundDistance > 0.0 && groundDistance < lightDistance) {
			return 0.0;
		}

		return 1.0;
	}

	vec3 sampleToSunTransmittanceAt(vec3 position, vec3 lightDirection) {
		float lightDistance = lightDistanceAt(position, lightDirection);
		float groundDistance = groundIntersectionDistance(position, lightDirection);

		if (groundDistance > 0.0 && groundDistance < lightDistance) {
			return vec3(0.0);
		}

		if (sampleToSunTransmittanceModelId > 1.5) {
			float sunUpCos = max(dot(
				lightDirection,
				normalize(atmosphereFrameUp)
			), EPSILON);
			float airMass = 1.0 / sunUpCos;

			return exp(-verticalOpticalDepthAbove(altitudeKm(position)) * airMass);
		}

		if (sampleToSunTransmittanceModelId < 0.5) {
			return vec3(1.0);
		}

		int requestedSteps = int(clamp(
			floor(sampleToSunTransmittanceSteps + 0.5),
			0.0,
			float(LIGHT_STEPS)
		));

		if (requestedSteps <= 0) {
			return vec3(1.0);
		}

		float maxDistance = max(atmosphereMaxViewDistanceKm, atmosphereTopAltitudeKm);
		float atmosphereDistance = atmosphereExitDistance(
			position,
			lightDirection,
			maxDistance
		);
		float marchDistance = min(lightDistance, atmosphereDistance);
		float stepDistance = marchDistance / float(requestedSteps);
		vec3 lightOpticalDepth = vec3(0.0);

		for (int index = 0; index < LIGHT_STEPS; index += 1) {
			if (index >= requestedSteps) {
				break;
			}

			float sampleDistance = (float(index) + 0.5) * stepDistance;
			vec3 samplePosition = position + lightDirection * sampleDistance;
			float altitude = altitudeKm(samplePosition);

			lightOpticalDepth += extinctionAtAltitude(altitude) * stepDistance;
		}

		return exp(-lightOpticalDepth);
	}

	vec3 sunRadianceAt(vec3 position, vec3 lightDirection) {
		vec3 radiance = sunColor * sunSolarIrradianceScale;

		if (sunKindId > 0.5 && falseSunRadianceDistanceFalloff > 0.5) {
			float distanceToSun = max(lightDistanceAt(position, lightDirection), EPSILON);
			float referenceDistance = max(falseSunRadianceReferenceDistanceKm, EPSILON);
			float distanceFalloff = (referenceDistance * referenceDistance)
				/ (distanceToSun * distanceToSun);

			radiance *= distanceFalloff;
		}

		return radiance;
	}

	float backgroundAtmosphereViewDistance(vec3 viewDirection) {
		float vertical = max(dot(viewDirection, normalize(atmosphereFrameUp)), 0.0);
		float horizonFactor = clamp(flatSlabHorizonViewDistanceFactor, 0.0, 1.0);
		float distanceFactor = mix(horizonFactor, 1.0, vertical);

		return backgroundAtmosphereViewDistanceKm * distanceFactor;
	}

	float resolvedViewDistance(float sceneDistance, bool hasSolidDepth, vec3 viewDirection) {
		float maxDistance = max(atmosphereMaxViewDistanceKm, atmosphereTopAltitudeKm);
		float atmosphereDistance = atmosphereExitDistance(
			cameraWorldPosition,
			viewDirection,
			maxDistance
		);
		float rawDistance = hasSolidDepth
			? min(sceneDistance, atmosphereDistance)
			: min(backgroundAtmosphereViewDistance(viewDirection), atmosphereDistance);

		return clamp(rawDistance, 0.0, maxDistance);
	}

	vec3 reconstructWorldPosition(vec2 uv, float depth) {
		vec4 clipPosition = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
		vec4 viewPosition = cameraProjectionMatrixInverse * clipPosition;

		viewPosition /= viewPosition.w;

		vec4 worldPosition = cameraViewMatrixInverse * viewPosition;

		return worldPosition.xyz;
	}

	void sampleAtmosphereViewRay(
		vec3 viewDirection,
		float viewDistance,
		out vec3 opticalDepth,
		out vec3 inScatteredLight
	) {
		float stepDistance = viewDistance / float(VIEW_STEPS);

		opticalDepth = vec3(0.0);
		inScatteredLight = vec3(0.0);

		for (int index = 0; index < VIEW_STEPS; index += 1) {
			float sampleDistance = (float(index) + 0.5) * stepDistance;
			vec3 samplePosition = cameraWorldPosition + viewDirection * sampleDistance;
			float altitude = altitudeKm(samplePosition);
			vec3 extinction = extinctionAtAltitude(altitude);
			vec3 viewOpticalDepth = opticalDepth + extinction * stepDistance * 0.5;
			vec3 viewTransmittance = exp(-viewOpticalDepth);
			vec3 lightDirection = lightDirectionAt(samplePosition);
			float lightVisibility = lightVisibilityAt(samplePosition, lightDirection);
			vec3 lightTransmittance = sampleToSunTransmittanceAt(
				samplePosition,
				lightDirection
			);
			vec3 sunRadiance = sunRadianceAt(samplePosition, lightDirection);
			float cosTheta = dot(viewDirection, lightDirection);
			vec3 rayleighScattering = rayleighScatteringAtAltitude(altitude)
				* rayleighPhase(cosTheta);
			vec3 mieScattering = mieScatteringAtAltitude(altitude)
				* miePhase(cosTheta);
			vec3 sampleScattering = (rayleighScattering + mieScattering)
				* sunRadiance
				* lightTransmittance
				* lightVisibility;

			inScatteredLight += viewTransmittance
				* sampleScattering
				* stepDistance;
			opticalDepth += extinction * stepDistance;
		}
	}

	void main() {
		vec4 sceneColor = texture2D(sceneColorTexture, vUv);
		float sceneDepth = texture2D(sceneDepthTexture, vUv).x;
		bool hasSolidDepth = sceneDepth < 0.999999;
		vec3 worldPosition = reconstructWorldPosition(
			vUv,
			hasSolidDepth ? sceneDepth : BACKGROUND_RAY_DEPTH
		);
		vec3 viewDirection = normalize(worldPosition - cameraWorldPosition);
		float viewDistance = resolvedViewDistance(
			length(worldPosition - cameraWorldPosition),
			hasSolidDepth,
			viewDirection
		);
		vec3 opticalDepth = vec3(0.0);
		vec3 inScatteredLight = vec3(0.0);

		sampleAtmosphereViewRay(
			viewDirection,
			viewDistance,
			opticalDepth,
			inScatteredLight
		);

		vec3 sceneTransmittance = exp(-opticalDepth);
		vec3 finalColor = sceneColor.rgb * sceneTransmittance + inScatteredLight;

		if (atmosphereDebugModeId > 3.5) {
			vec3 phaseSamplePosition = cameraWorldPosition
				+ viewDirection * viewDistance * 0.5;
			vec3 phaseLightDirection = lightDirectionAt(phaseSamplePosition);
			float phaseCosTheta = dot(viewDirection, phaseLightDirection);

			finalColor = vec3(
				clamp(phaseCosTheta * 0.5 + 0.5, 0.0, 1.0),
				clamp(rayleighPhase(phaseCosTheta) * 8.0, 0.0, 1.0),
				clamp(miePhase(phaseCosTheta) / 3.5, 0.0, 1.0)
			);
		} else if (atmosphereDebugModeId > 2.5) {
			finalColor = clamp(inScatteredLight, 0.0, 1.0);
		} else if (atmosphereDebugModeId > 1.5) {
			float averageOpticalDepth = (
				opticalDepth.r
				+ opticalDepth.g
				+ opticalDepth.b
			) / 3.0;
			float averageTransmittance = (
				sceneTransmittance.r
				+ sceneTransmittance.g
				+ sceneTransmittance.b
			) / 3.0;
			float depthMask = hasSolidDepth ? 1.0 : 0.0;

			finalColor = vec3(
				clamp(averageOpticalDepth / 8.0, 0.0, 1.0),
				clamp(averageTransmittance, 0.0, 1.0),
				depthMask
			);
		} else if (atmosphereDebugModeId > 0.5) {
			float normalizedDistance = clamp(
				viewDistance / max(atmosphereMaxViewDistanceKm, EPSILON),
				0.0,
				1.0
			);
			float depthMask = hasSolidDepth ? 1.0 : 0.0;

			finalColor = vec3(normalizedDistance, depthMask, 1.0 - depthMask);
		}

		gl_FragColor = vec4(finalColor, sceneColor.a);
	}
`;

const DEBUG_MODE_IDS = Object.freeze({
	none: 0,
	'ray-length': 1,
	'optical-depth': 2,
	scattering: 3,
	'phase-angle': 4,
});
const SAMPLE_TO_SUN_TRANSMITTANCE_MODEL_IDS = Object.freeze({
	none: 0,
	'light-march': 1,
	'air-mass': 2,
});
const DEFAULT_BACKGROUND_ATMOSPHERE_VIEW_DISTANCE_KM = 100;
const DEFAULT_FLAT_SLAB_HORIZON_VIEW_DISTANCE_FACTOR = 0.25;
const DEFAULT_SAMPLE_TO_SUN_TRANSMITTANCE_MODEL = 'air-mass';

function shouldUseFalseSunRadianceDistanceFalloff(rendering) {
	return rendering?.falseSunRadiance?.model === 'point-inverse-square-reference'
		&& rendering.falseSunRadiance.distanceFalloff !== false;
}

function debugModeId(mode) {
	return DEBUG_MODE_IDS[mode] ?? DEBUG_MODE_IDS.none;
}

function sampleToSunTransmittanceModelId(model) {
	return SAMPLE_TO_SUN_TRANSMITTANCE_MODEL_IDS[model]
		?? SAMPLE_TO_SUN_TRANSMITTANCE_MODEL_IDS[DEFAULT_SAMPLE_TO_SUN_TRANSMITTANCE_MODEL];
}

function useAnimationLoopFrame(animationLoop, callback) {
	const callbackRef = useRef(callback);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	useEffect(() => {
		if (!animationLoop?.listenFrame) {
			return undefined;
		}

		const listenerId = animationLoop.listenFrame((frame) => {
			callbackRef.current(frame);
		});

		return () => {
			animationLoop.unlistenFrame(listenerId);
		};
	}, [animationLoop]);
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
 * @param {{ scene: FlatSimulationScene | null | undefined, children: React.ReactNode }} props - Carry scene state and solid render contents.
 * @returns {React.ReactNode}
 */
export default function FlatAtmosphereComposer({ scene, children }) {
	const { camera, gl, size } = useThree();
	const animationLoop = useContext(FlatContext).animationLoop;
	const observerPosition = scene?.observer?.position;
	const atmosphereSun = scene?.lighting?.atmosphereSun || null;
	const target = useMemo(() => createRenderTarget(
		Math.max(1, Math.floor(size.width)),
		Math.max(1, Math.floor(size.height)),
	), []);
	const solidScene = useMemo(() => {
		const nextScene = new THREE.Scene();

		nextScene.background = new THREE.Color('#060912');

		return nextScene;
	}, []);
	const adapter = useMemo(() => (
		createAtmosphereUniformAdapter(scene?.atmosphere, atmosphereSun)
	), [atmosphereSun, scene?.atmosphere]);
	const uniforms = useMemo(() => ({
		...adapter.uniforms,
		sceneColorTexture: { value: target.texture },
		sceneDepthTexture: { value: target.depthTexture },
		cameraProjectionMatrixInverse: { value: camera.projectionMatrixInverse },
		cameraViewMatrixInverse: { value: camera.matrixWorld },
		cameraWorldPosition: { value: [camera.position.x, camera.position.y, camera.position.z] },
		atmosphereMaxViewDistanceKm: { value: Math.max((scene?.atmosphere?.profile?.topAltitudeKm ?? 80) * 4, 1) },
		backgroundAtmosphereViewDistanceKm: {
			value: Math.max(
				Number(scene?.atmosphere?.rendering?.backgroundAtmosphereViewDistanceKm)
					|| scene?.atmosphere?.profile?.topAltitudeKm
					|| DEFAULT_BACKGROUND_ATMOSPHERE_VIEW_DISTANCE_KM,
				0.000001,
			),
		},
		flatSlabHorizonViewDistanceFactor: {
			value: Math.max(
				Number(scene?.atmosphere?.rendering?.flatSlabHorizonViewDistanceFactor)
					|| DEFAULT_FLAT_SLAB_HORIZON_VIEW_DISTANCE_FACTOR,
				0,
			),
		},
		falseSunRadianceReferenceDistanceKm: {
			value: Math.max(
				Number(scene?.atmosphere?.rendering?.falseSunRadiance?.referenceDistanceKm) || 4800,
				0.000001,
			),
		},
		falseSunRadianceDistanceFalloff: {
			value: shouldUseFalseSunRadianceDistanceFalloff(scene?.atmosphere?.rendering) ? 1 : 0,
		},
		sampleToSunTransmittanceModelId: {
			value: sampleToSunTransmittanceModelId(
				scene?.atmosphere?.rendering?.sampleToSunTransmittanceModel,
			),
		},
		sampleToSunTransmittanceSteps: {
			value: Math.max(
				Number(scene?.atmosphere?.rendering?.sampleToSunTransmittanceSteps) || 0,
				0,
			),
		},
		atmosphereDebugModeId: {
			value: debugModeId(scene?.atmosphere?.rendering?.debugMode),
		},
	}), [
		adapter.uniforms,
		camera,
		scene?.atmosphere?.rendering?.debugMode,
		scene?.atmosphere?.rendering?.backgroundAtmosphereViewDistanceKm,
		scene?.atmosphere?.rendering?.flatSlabHorizonViewDistanceFactor,
		scene?.atmosphere?.rendering?.sampleToSunTransmittanceModel,
		scene?.atmosphere?.rendering?.sampleToSunTransmittanceSteps,
		scene?.atmosphere?.rendering?.falseSunRadiance,
		scene?.atmosphere?.profile?.topAltitudeKm,
		target,
	]);

	useEffect(() => {
		target.setSize(
			Math.max(1, Math.floor(size.width)),
			Math.max(1, Math.floor(size.height)),
		);
	}, [size.height, size.width, target]);

	useEffect(() => () => {
		target.dispose();
		target.depthTexture.dispose();
	}, [target]);

	useAnimationLoopFrame(animationLoop, (frame) => {
		if (!adapter.enabled) {
			return;
		}

		adapter.updateSunUniforms(
			resolveAnimatedAtmosphereSun(scene?.sun, frame.rotationAngles.solarDayRad, {
				observerPosition,
			}) || atmosphereSun,
		);
		camera.updateMatrixWorld();
		camera.updateProjectionMatrix();
		uniforms.cameraProjectionMatrixInverse.value = camera.projectionMatrixInverse;
		uniforms.cameraViewMatrixInverse.value = camera.matrixWorld;
		uniforms.cameraWorldPosition.value[0] = camera.position.x;
		uniforms.cameraWorldPosition.value[1] = camera.position.y;
		uniforms.cameraWorldPosition.value[2] = camera.position.z;
		uniforms.atmosphereMaxViewDistanceKm.value = Math.max(
			(scene?.atmosphere?.profile?.topAltitudeKm ?? 80) * 4,
			1,
		);
		uniforms.backgroundAtmosphereViewDistanceKm.value = Math.max(
			Number(scene?.atmosphere?.rendering?.backgroundAtmosphereViewDistanceKm)
				|| scene?.atmosphere?.profile?.topAltitudeKm
				|| DEFAULT_BACKGROUND_ATMOSPHERE_VIEW_DISTANCE_KM,
			0.000001,
		);
		uniforms.flatSlabHorizonViewDistanceFactor.value = Math.max(
			Number(scene?.atmosphere?.rendering?.flatSlabHorizonViewDistanceFactor)
				|| DEFAULT_FLAT_SLAB_HORIZON_VIEW_DISTANCE_FACTOR,
			0,
		);
		uniforms.falseSunRadianceReferenceDistanceKm.value = Math.max(
			Number(scene?.atmosphere?.rendering?.falseSunRadiance?.referenceDistanceKm) || 4800,
			0.000001,
		);
		uniforms.falseSunRadianceDistanceFalloff.value =
			shouldUseFalseSunRadianceDistanceFalloff(scene?.atmosphere?.rendering) ? 1 : 0;
		uniforms.sampleToSunTransmittanceModelId.value = sampleToSunTransmittanceModelId(
			scene?.atmosphere?.rendering?.sampleToSunTransmittanceModel,
		);
		uniforms.sampleToSunTransmittanceSteps.value = Math.max(
			Number(scene?.atmosphere?.rendering?.sampleToSunTransmittanceSteps) || 0,
			0,
		);
		uniforms.atmosphereDebugModeId.value = debugModeId(
			scene?.atmosphere?.rendering?.debugMode,
		);

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
