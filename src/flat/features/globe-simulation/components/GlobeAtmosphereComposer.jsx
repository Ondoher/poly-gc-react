import React, { useEffect, useMemo } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createGlobeAtmosphereUniformAdapter } from './atmosphere-uniforms.js';

const FULLSCREEN_VERTEX_SHADER = `
	varying vec2 vUv;

	void main() {
		vUv = uv;
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

const COMPOSITION_FRAGMENT_SHADER = `
	const int VIEW_STEPS = 32;
	const float EPSILON = 0.000001;
	const float PI = 3.141592653589793;

	uniform sampler2D sceneColorTexture;
	uniform sampler2D sceneDepthTexture;
	uniform mat4 cameraProjectionMatrixInverse;
	uniform mat4 cameraViewMatrixInverse;
	uniform vec3 cameraWorldPosition;
	uniform vec3 cameraForward;
	uniform vec3 cameraRight;
	uniform vec3 cameraUp;
	uniform float cameraTanHalfFov;
	uniform float cameraAspect;
	uniform float atmosphereTopAltitudeKm;
	uniform float atmosphereRayleighScaleHeightKm;
	uniform float atmosphereAerosolScaleHeightKm;
	uniform vec3 atmosphereRayleighBetaKm;
	uniform vec3 atmosphereMieExtinctionBetaKm;
	uniform vec3 atmosphereMieScatteringBetaKm;
	uniform float atmosphereMieAnisotropy;
	uniform vec3 atmospherePlanetCenter;
	uniform float atmospherePlanetRadiusKm;
	uniform float sunKindId;
	uniform vec3 sunDirection;
	uniform vec3 sunPosition;
	uniform vec3 sunColor;
	uniform float sunTopOfAtmosphereIrradianceWm2;
	uniform float displayRadiometricToSceneRgbScale;
	uniform float displayExposure;
	uniform float displayToneMappingId;

	varying vec2 vUv;

	vec3 safeNormalize(vec3 value, vec3 fallback) {
		float valueLength = length(value);

		if (valueLength <= EPSILON) {
			return fallback;
		}

		return value / valueLength;
	}

	float altitudeKm(vec3 position) {
		return length(position - atmospherePlanetCenter) - atmospherePlanetRadiusKm;
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

		return atmosphereRayleighBetaKm * rayleigh
			+ atmosphereMieExtinctionBetaKm * aerosol;
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

	float sphereIntersectionDistance(
		vec3 origin,
		vec3 direction,
		vec3 center,
		float radius
	) {
		vec3 offset = origin - center;
		float b = dot(offset, direction);
		float c = dot(offset, offset) - radius * radius;
		float discriminant = b * b - c;

		if (discriminant < 0.0) {
			return -1.0;
		}

		float root = sqrt(discriminant);
		float nearDistance = -b - root;
		float farDistance = -b + root;

		if (nearDistance > EPSILON) {
			return nearDistance;
		}

		if (farDistance > EPSILON) {
			return farDistance;
		}

		return -1.0;
	}

	float atmosphereExitDistance(vec3 origin, vec3 direction) {
		return sphereIntersectionDistance(
			origin,
			direction,
			atmospherePlanetCenter,
			atmospherePlanetRadiusKm + atmosphereTopAltitudeKm
		);
	}

	vec3 lightDirectionAt(vec3 position) {
		if (sunKindId > 0.5) {
			return safeNormalize(sunPosition - position, vec3(0.0, 1.0, 0.0));
		}

		return safeNormalize(sunDirection, vec3(0.0, 1.0, 0.0));
	}

	float lightVisibilityAt(vec3 position, vec3 lightDirection) {
		float groundDistance = sphereIntersectionDistance(
			position,
			lightDirection,
			atmospherePlanetCenter,
			atmospherePlanetRadiusKm
		);

		return groundDistance > 0.0 ? 0.0 : 1.0;
	}

	vec3 sampleToSunTransmittanceAt(vec3 position, vec3 lightDirection) {
		vec3 localUp = safeNormalize(
			position - atmospherePlanetCenter,
			vec3(0.0, 1.0, 0.0)
		);
		float sunUpCos = max(dot(lightDirection, localUp), 0.03);

		return exp(-verticalOpticalDepthAbove(altitudeKm(position)) / sunUpCos);
	}

	vec3 toneMapDisplayRgb(vec3 value) {
		vec3 finiteValue = max(value, vec3(0.0));

		if (displayToneMappingId > 0.5) {
			return finiteValue / (vec3(1.0) + finiteValue);
		}

		return clamp(finiteValue, vec3(0.0), vec3(1.0));
	}

	vec3 mapRadiometricToDisplayRgb(vec3 radiometricRgb) {
		vec3 exposedRgb = radiometricRgb
			* displayRadiometricToSceneRgbScale
			* displayExposure;

		return toneMapDisplayRgb(exposedRgb);
	}

	vec3 reconstructWorldPosition(vec2 uv, float depth) {
		vec4 clipPosition = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
		vec4 viewPosition = cameraProjectionMatrixInverse * clipPosition;

		viewPosition /= viewPosition.w;

		vec4 worldPosition = cameraViewMatrixInverse * viewPosition;

		return worldPosition.xyz;
	}

	vec3 rayDirectionFromUv(vec2 uv) {
		vec2 screenPosition = uv * 2.0 - 1.0;

		return safeNormalize(
			cameraForward
				+ cameraRight * screenPosition.x * cameraTanHalfFov * cameraAspect
				+ cameraUp * screenPosition.y * cameraTanHalfFov,
			cameraForward
		);
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
			float cosTheta = dot(viewDirection, lightDirection);
			vec3 rayleighScattering = rayleighScatteringAtAltitude(altitude)
				* rayleighPhase(cosTheta);
			vec3 mieScattering = mieScatteringAtAltitude(altitude)
				* miePhase(cosTheta);
			vec3 sampleScattering = (rayleighScattering + mieScattering)
				* sunColor
				* sunTopOfAtmosphereIrradianceWm2
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
		vec3 viewDirection = rayDirectionFromUv(vUv);
		vec3 worldPosition = hasSolidDepth
			? reconstructWorldPosition(vUv, sceneDepth)
			: cameraWorldPosition + viewDirection;
		float atmosphereDistance = atmosphereExitDistance(
			cameraWorldPosition,
			viewDirection
		);
		float groundDistance = sphereIntersectionDistance(
			cameraWorldPosition,
			viewDirection,
			atmospherePlanetCenter,
			atmospherePlanetRadiusKm
		);
		float sceneDistance = length(worldPosition - cameraWorldPosition);
		float viewDistance = hasSolidDepth
			? min(sceneDistance, atmosphereDistance)
			: atmosphereDistance;
		vec3 opticalDepth = vec3(0.0);
		vec3 inScatteredLight = vec3(0.0);
		vec3 finalRadiometricColor = sceneColor.rgb;

		if (!hasSolidDepth && groundDistance > EPSILON) {
			viewDistance = min(viewDistance, groundDistance);
		}

		if (atmosphereDistance > EPSILON && viewDistance > EPSILON) {
			sampleAtmosphereViewRay(
				viewDirection,
				viewDistance,
				opticalDepth,
				inScatteredLight
			);

			finalRadiometricColor =
				sceneColor.rgb * exp(-opticalDepth)
				+ inScatteredLight;
		}

		gl_FragColor = vec4(
			mapRadiometricToDisplayRgb(finalRadiometricColor),
			1.0
		);

		#include <colorspace_fragment>
	}
`;

/**
 * Create the globe solid-scene render target.
 *
 * @param {number} width - Store target width in pixels.
 * @param {number} height - Store target height in pixels.
 * @returns {THREE.WebGLRenderTarget} The color/depth render target.
 */
export function createGlobeSolidRenderTarget(width, height) {
	const target = new THREE.WebGLRenderTarget(width, height, {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBAFormat,
		type: THREE.HalfFloatType,
		depthBuffer: true,
		stencilBuffer: false,
	});

	target.depthTexture = new THREE.DepthTexture(width, height);
	target.depthTexture.format = THREE.DepthFormat;
	target.depthTexture.type = THREE.UnsignedIntType;
	target.texture.colorSpace = THREE.LinearSRGBColorSpace;

	return target;
}

/**
 * Create atmosphere composition uniforms for the globe composer.
 *
 * @param {THREE.WebGLRenderTarget} target - Store the solid-scene target.
 * @param {GlobeSimulationAtmosphereUniformAdapter} adapter - Store atmosphere uniforms.
 * @param {THREE.Camera} camera - Store the active camera.
 * @returns {Record<string, { value: unknown }>} The shader uniform map.
 */
export function createGlobeAtmosphereCompositionUniforms(target, adapter, camera) {
	return {
		...adapter.uniforms,
		sceneColorTexture: { value: target.texture },
		sceneDepthTexture: { value: target.depthTexture },
		cameraProjectionMatrixInverse: { value: camera.projectionMatrixInverse },
		cameraViewMatrixInverse: { value: camera.matrixWorld },
		cameraWorldPosition: {
			value: new THREE.Vector3(
				camera.position.x,
				camera.position.y,
				camera.position.z,
			),
		},
		cameraForward: { value: new THREE.Vector3(0, 0, -1) },
		cameraRight: { value: new THREE.Vector3(1, 0, 0) },
		cameraUp: { value: new THREE.Vector3(0, 1, 0) },
		cameraTanHalfFov: { value: 1 },
		cameraAspect: { value: 1 },
	};
}

/**
 * Render globe solid scene contents into color/depth, then compose atmosphere.
 *
 * This pass uses the spherical-shell atmosphere frame as the geometry owner:
 * solid pixels integrate to their depth hit, while sky pixels integrate to the
 * atmosphere shell exit.
 *
 * @param {{ scene: object | null | undefined, children: React.ReactNode }} props - Carry scene state and solid render contents.
 * @returns {React.ReactNode}
 */
export default function GlobeAtmosphereComposer({ scene, children }) {
	const { camera, gl, size } = useThree();
	const target = useMemo(() => createGlobeSolidRenderTarget(
		Math.max(1, Math.floor(size.width)),
		Math.max(1, Math.floor(size.height)),
	), []);
	const solidScene = useMemo(() => {
		const nextScene = new THREE.Scene();

		nextScene.background = new THREE.Color('#070910');

		return nextScene;
	}, []);
	const adapter = useMemo(() => (
		createGlobeAtmosphereUniformAdapter(scene)
	), [scene]);
	const uniforms = useMemo(
		() => createGlobeAtmosphereCompositionUniforms(target, adapter, camera),
		[adapter, camera, target],
	);

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

	useFrame(() => {
		if (!adapter.enabled) {
			return;
		}

		camera.updateMatrixWorld();
		camera.updateProjectionMatrix();
		uniforms.cameraProjectionMatrixInverse.value = camera.projectionMatrixInverse;
		uniforms.cameraViewMatrixInverse.value = camera.matrixWorld;
		uniforms.cameraWorldPosition.value.set(
			camera.position.x,
			camera.position.y,
			camera.position.z,
		);
		camera.getWorldDirection(uniforms.cameraForward.value);
		uniforms.cameraRight.value
			.setFromMatrixColumn(camera.matrixWorld, 0)
			.normalize();
		uniforms.cameraUp.value
			.setFromMatrixColumn(camera.matrixWorld, 1)
			.normalize();
		uniforms.cameraTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
		uniforms.cameraAspect.value = camera.aspect || 1;

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
				/>
			</mesh>
		</React.Fragment>
	);
}
