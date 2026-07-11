import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

import Algorithm32AtmosphereComposer from './Algorithm32AtmosphereComposer.jsx';

/**
 * Provide React Three Fiber renderer state to the class-based Algorithm32 wrapper.
 *
 * @param {object} props - Supplies Algorithm32 wrapper props.
 * @returns {React.ReactNode} The class wrapper bound to R3F context.
 */
export default function Algorithm32R3FAtmosphereComposer(props) {
	const composerRef = useRef(null);
	const { camera, gl, scene, size } = useThree();

	useFrame((frameState, delta) => {
		const rendered = composerRef.current?.renderAlgorithm32Frame(frameState, delta);
		const renderer = frameState.gl ?? gl;

		if (!rendered) {
			const fallbackScene = composerRef.current?.getFallbackScene?.() ?? frameState.scene ?? scene;
			const fallbackCamera = frameState.camera ?? camera;

			renderer.render(fallbackScene, fallbackCamera);
		}
	}, props.renderPriority ?? 1);

	return (
		<Algorithm32AtmosphereComposer
			{...props}
			ref={composerRef}
			camera={camera}
			renderer={gl}
			size={size}
		/>
	);
}
