export interface GlobeSimulationController {
	/**
	 * Mount the globe page feature.
	 */
	mount(options?: Record<string, unknown>): unknown;

	/**
	 * Get current globe page state.
	 */
	getState(): Record<string, unknown>;
}
