import React from 'react';
import { Canvas } from '@react-three/fiber';
import FlatAtmosphereComposer from './FlatAlgorithm32AtmosphereComposer.jsx';

const OBSERVER_EYE_HEIGHT_KM = 0.01;

function observerCameraHeightKm(observer) {
	const cameraHeightKm = Number(observer?.view?.cameraHeightKm);
	const viewAltitudeKm = Number(observer?.view?.altitudeKm);

	if (Number.isFinite(cameraHeightKm)) {
		return cameraHeightKm;
	}

	if (Number.isFinite(viewAltitudeKm)) {
		return viewAltitudeKm;
	}

	return OBSERVER_EYE_HEIGHT_KM;
}

function FlatSkySceneContent({ scene }) {
	return (
		<React.Fragment>
			<color attach="background" args={['#060912']} />
			<FlatAtmosphereComposer scene={scene} />
		</React.Fragment>
	);
}

/**
 * Render the flat-simulation Three.js canvas.
 *
 * Required Algorithm32 ground endpoints and source lights are created by the
 * production Algorithm32 composer from the configured geometry/light-source
 * abstractions.
 *
 * @param {{ scene: FlatSimulationScene | null | undefined }} props - Carry the scene view model.
 * @returns {React.ReactNode}
 */
export default function FlatSkyScene({ scene }) {
	const eyeHeightKm = observerCameraHeightKm(scene?.observer);

	return (
		<div className="flat-sky-scene">
			<Canvas
				camera={{
					position: [0, eyeHeightKm, 0],
					rotation: [0, 0, 0],
					fov: 72,
					near: 0.0001,
					far: 50000,
				}}
			>
				<FlatSkySceneContent scene={scene} />
			</Canvas>
		</div>
	);
}
