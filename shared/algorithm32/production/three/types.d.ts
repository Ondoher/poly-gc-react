/**
 * Configure an exact spherical Three ground endpoint.
 */
type ExactSphereGroundObjectConfig = {
	/**
	 * Store the sphere radius in scene units.
	 */
	readonly radiusSceneUnits: number;

	/**
	 * Store the sphere center in scene units.
	 */
	readonly centerSceneUnits: SceneVector3;

	/**
	 * Store scene units to Algorithm32 meters scale.
	 */
	readonly metersPerSceneUnit: number;

	/**
	 * Store optional material/profile id.
	 */
	readonly spectralReferenceId?: string | null;

	/**
	 * Store optional object name.
	 */
	readonly name?: string;
};

/**
 * Configure an exact flat Three ground endpoint.
 */
type ExactFlatGroundObjectConfig = {
	/**
	 * Store the plane center in scene units.
	 */
	readonly centerSceneUnits?: SceneVector3;

	/**
	 * Store the plane width in scene units.
	 */
	readonly widthSceneUnits: number;

	/**
	 * Store the plane depth in scene units.
	 */
	readonly depthSceneUnits: number;

	/**
	 * Store scene units to Algorithm32 meters scale.
	 */
	readonly metersPerSceneUnit: number;

	/**
	 * Store optional material/profile id.
	 */
	readonly spectralReferenceId?: string | null;

	/**
	 * Store optional object name.
	 */
	readonly name?: string;
};
