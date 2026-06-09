export interface FalseSimulationController {
	/**
	 * Mount the false-simulation page feature.
	 */
	mount(options?: Record<string, unknown>): unknown;

	/**
	 * Get current false-simulation page state.
	 */
	getState(): Record<string, unknown>;
}
