import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { resolveAnimatedSun } from '../models/sun-animation.js';
import { createAtmosphereUniformAdapter } from './atmosphere-uniforms.js';

const ATMOSPHERE_SHELL_VERTEX_SHADER = `
	varying vec3 vWorldPosition;

	void main() {
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);

		vWorldPosition = worldPosition.xyz;
		gl_Position = projectionMatrix * viewMatrix * worldPosition;
	}
`;

const ATMOSPHERE_SHELL_FRAGMENT_SHADER = `
	const int VIEW_STEPS = 16;
	const int LIGHT_STEPS = 8;
	const float PI = 3.141592653589793;
	const float EPSILON = 0.000001;

	uniform float atmosphereTopAltitudeKm;
	uniform float atmosphereRayleighScaleHeightKm;
	uniform float atmosphereAerosolScaleHeightKm;
	uniform vec3 atmosphereRayleighBetaKm;
	uniform vec3 atmosphereMieBetaKm;
	uniform float atmosphereMieAnisotropy;
	uniform float atmosphereMaxAirlight;
	uniform vec3 atmosphereFrameOrigin;
	uniform vec3 atmosphereFrameUp;
	uniform float sunKindId;
	uniform vec3 sunDirection;
	uniform vec3 sunPosition;
	uniform vec3 sunColor;
	uniform float sunIntensity;
	uniform float atmosphereShellExposure;
	uniform float atmosphereShellOpacity;

	varying vec3 vWorldPosition;

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

	void main() {
		vec3 viewDirection = normalize(vWorldPosition - cameraPosition);
		float shellDistance = length(vWorldPosition - cameraPosition);
		float viewDistance = atmosphereExitDistance(cameraPosition, viewDirection, shellDistance);
		float stepDistance = viewDistance / float(VIEW_STEPS);
		vec3 opticalDepth = vec3(0.0);
		vec3 inScatteredLight = vec3(0.0);

		for (int index = 0; index < VIEW_STEPS; index += 1) {
			float sampleDistance = (float(index) + 0.5) * stepDistance;
			vec3 samplePosition = cameraPosition + viewDirection * sampleDistance;
			float altitude = altitudeKm(samplePosition);

			if (altitude < 0.0 || altitude > atmosphereTopAltitudeKm) {
				continue;
			}

			vec3 extinction = extinctionAtAltitude(altitude);
			vec3 viewTransmittance = exp(-(opticalDepth + extinction * stepDistance * 0.5));
			vec3 lightDirection = sunKindId > 0.5
				? normalize(sunPosition - samplePosition)
				: normalize(sunDirection);
			float lightDistance = sunKindId > 0.5
				? length(sunPosition - samplePosition)
				: atmosphereTopAltitudeKm * 20.0;
			float groundDistance = groundIntersectionDistance(samplePosition, lightDirection);

			if (groundDistance < 0.0 || groundDistance > lightDistance) {
				float lightPathDistance = min(
					atmosphereExitDistance(samplePosition, lightDirection, atmosphereTopAltitudeKm * 20.0),
					lightDistance
				);
				vec3 lightTransmittance = transmittanceForPath(samplePosition, lightDirection, lightPathDistance);
				float cosTheta = clamp(dot(viewDirection, lightDirection), -1.0, 1.0);
				float rayleighDensity = relativeDensity(altitude, atmosphereRayleighScaleHeightKm);
				float aerosolDensity = relativeDensity(altitude, atmosphereAerosolScaleHeightKm);
				vec3 rayleigh = atmosphereRayleighBetaKm * rayleighDensity * rayleighPhase(cosTheta);
				vec3 mie = atmosphereMieBetaKm * aerosolDensity * miePhase(cosTheta);
				vec3 scattering = (rayleigh + mie) * sunColor * sunIntensity;

				inScatteredLight += viewTransmittance * lightTransmittance * scattering * stepDistance;
			}

			opticalDepth += extinction * stepDistance;
		}

		vec3 color = clamp(inScatteredLight * atmosphereShellExposure, vec3(0.0), vec3(atmosphereMaxAirlight));
		float alpha = clamp(max(max(color.r, color.g), color.b) * atmosphereShellOpacity, 0.0, 0.92);

		if (alpha <= 0.001) {
			discard;
		}

		gl_FragColor = vec4(color, alpha);
	}
`;

/**
 * Render the first light-aware false-simulation atmosphere shell.
 *
 * This is a validation pass for shared atmosphere/sun uniforms. It renders
 * sky airlight before the solid scene; depth-aware terrain/object composition
 * remains the later target.
 *
 * @param {{ scene: FalseSimulationScene | null | undefined, radiusKm: number }} props - Carry scene state and shell radius.
 * @returns {React.ReactNode}
 */
export default function FalseAtmosphere({ scene, radiusKm }) {
	const materialRef = useRef(null);
	const meshRef = useRef(null);
	const { camera } = useThree();
	const observerPosition = scene?.observer?.position;
	const adapter = useMemo(() => {
		const resolvedSun = resolveAnimatedSun(scene?.sun, 0, {
			observerPosition,
		});

		return createAtmosphereUniformAdapter(scene?.atmosphere, resolvedSun?.light || scene?.lighting?.sun);
	}, [scene?.atmosphere, scene?.lighting?.sun, scene?.sun, observerPosition]);
	const uniforms = useMemo(() => ({
		...adapter.uniforms,
		atmosphereShellExposure: { value: scene?.atmosphere?.rendering?.shellExposure ?? 36 },
		atmosphereShellOpacity: { value: scene?.atmosphere?.rendering?.shellOpacity ?? 18 },
	}), [adapter.uniforms, scene?.atmosphere?.rendering?.shellExposure, scene?.atmosphere?.rendering?.shellOpacity]);
	const shellRadius = Math.max(
		Number(scene?.atmosphere?.profile?.topAltitudeKm || 100) * 6,
		Number(radiusKm || 0) * 0.03,
		600,
	);

	useFrame(({ clock }) => {
		if (!adapter.enabled) {
			return;
		}

		const resolvedSun = resolveAnimatedSun(scene?.sun, clock.getElapsedTime(), {
			observerPosition,
		});

		adapter.updateSunUniforms(resolvedSun?.light || scene?.lighting?.sun);

		if (meshRef.current) {
			meshRef.current.position.copy(camera.position);
		}
	});

	if (!adapter.enabled) {
		return null;
	}

	return (
		<mesh ref={meshRef} position={camera.position.toArray()} renderOrder={-1000}>
			<sphereGeometry args={[shellRadius, 48, 24]} />
			<shaderMaterial
				ref={materialRef}
				vertexShader={ATMOSPHERE_SHELL_VERTEX_SHADER}
				fragmentShader={ATMOSPHERE_SHELL_FRAGMENT_SHADER}
				uniforms={uniforms}
				transparent
				depthWrite={false}
				depthTest={false}
				side={THREE.BackSide}
				blending={THREE.NormalBlending}
				toneMapped={false}
			/>
		</mesh>
	);
}
