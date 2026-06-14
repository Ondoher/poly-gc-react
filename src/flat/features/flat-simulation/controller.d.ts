export interface FlatSimulationController {
	/**
	 * Mount the flat-simulation page feature.
	 */
	mount(options?: Record<string, unknown>): unknown;

	/**
	 * Get current flat-simulation page state.
	 */
	getState(): Record<string, unknown>;
}
