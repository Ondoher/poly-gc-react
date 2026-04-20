/**
 * Shared variable-name list for reading one layout metric family from
 * generator-emitted CSS custom properties.
 */
export const LAYOUT_METRIC_CSS_VAR_NAMES: LayoutMetricCssVarNameList;

/**
 * Define the exported service contract for MJ layout scaling.
 *
 * The public interface is intentionally one-shot and stateless for request
 * data: pass one config object in and receive one derived view-state object
 * back.
 */
export interface LayoutScalingService {
	/**
	 * Return the stable controller-facing layout view state.
	 *
	 * @param config - Specify the current layout, space, and candidate size names.
	 */
	getViewState(config: LayoutScalingConfig): LayoutScalingViewState;

	/**
	 * Return the richer internal layout-scaling snapshot for debugging or analytics.
	 *
	 * @param config - Specify the current layout, space, and candidate size names.
	 */
	getDebugState(config: LayoutScalingConfig): LayoutScalingResult;
}
