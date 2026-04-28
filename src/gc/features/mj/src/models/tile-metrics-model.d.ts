/**
 * Shared variable-name list for reading one layout metric family from
 * generator-emitted CSS custom properties.
 */
export const LAYOUT_METRIC_CSS_VAR_NAMES: LayoutMetricCssVarNameList;

/**
 * Define the exported service contract for the MJ tile metrics model.
 *
 * The public interface is intentionally one-shot and stateless for request
 * data: pass one config object in and receive one derived view-state object
 * back.
 */
export interface TileMetricsModel {
	/**
	 * Return the stable controller-facing tile metrics view state.
	 *
	 * @param config - Specify the current layout, space, and candidate size names.
	 */
	getViewState(config: TileMetricsConfig): TileMetricsViewState;

	/**
	 * Return the richer internal tile-metrics snapshot for debugging or analytics.
	 *
	 * @param config - Specify the current layout, space, and candidate size names.
	 */
	getDebugState(config: TileMetricsConfig): TileMetricsResult;
}
