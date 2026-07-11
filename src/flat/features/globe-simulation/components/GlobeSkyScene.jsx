import React, { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import GlobeAtmosphereComposer from './GlobeAlgorithm32AtmosphereComposer.jsx';

function vectorFromState(vector) {
	return new THREE.Vector3(
		Number(vector?.x) || 0,
		Number(vector?.y) || 0,
		Number(vector?.z) || 0,
	);
}

function SurfaceLookCamera({ cameraState, observerFrame }) {
	const { camera } = useThree();
	const position = useMemo(() => vectorFromState(cameraState?.positionKm), [cameraState?.positionKm]);
	const up = useMemo(
		() => vectorFromState(observerFrame?.up),
		[observerFrame?.up],
	);
	const target = useMemo(() => vectorFromState(cameraState?.targetKm), [cameraState?.targetKm]);

	useEffect(() => {
		camera.position.copy(position);
		camera.up.copy(up);
		camera.lookAt(target);
		camera.updateProjectionMatrix();
	}, [camera, position, target, up]);

	return null;
}

/**
 * Render the globe-simulation Three.js canvas.
 *
 * Required Algorithm32 ground endpoints and source lights are created by the
 * production Algorithm32 composer from the configured geometry/light-source
 * abstractions.
 *
 * @param {{ scene: GlobeSimulationScene | null | undefined }} props - Carry the scene view model.
 * @returns {React.ReactNode}
 */
export default function GlobeSkyScene({ scene }) {
	const cameraState = scene?.camera || {};
	const cameraPosition = vectorFromState(cameraState.positionKm);

	if (!scene) {
		return null;
	}

	return (
		<div className="globe-simulation-canvas">
			<Canvas
				camera={{
					position: cameraPosition.toArray(),
					near: Number(cameraState.nearKm) || 1,
					far: Number(cameraState.farKm) || 32000,
					fov: Number(cameraState.fov) || 42,
				}}
				gl={{
					antialias: true,
					alpha: true,
					logarithmicDepthBuffer: true,
					preserveDrawingBuffer: true,
				}}
			>
				<color attach="background" args={['#070910']} />
				<SurfaceLookCamera
					cameraState={cameraState}
					observerFrame={scene?.observer?.frame}
				/>
				<GlobeAtmosphereComposer scene={scene} />
			</Canvas>
		</div>
	);
}
