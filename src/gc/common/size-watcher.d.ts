/**
 * Describe the current viewport dimensions.
 */
type SizeWatcherViewportSize = {
	/**
	 * Store the current viewport width in pixels.
	 */
	width: number;

	/**
	 * Store the current viewport height in pixels.
	 */
	height: number;
}

/**
 * Describe the coarse viewport orientation.
 *
 * Square and near-square viewports are treated as landscape.
 */
type SizeWatcherOrientation = "portrait" | "landscape";

/**
 * Describe the coarse viewport width band.
 */
type SizeWatcherSizeClass = "compact" | "regular" | "wide";

/**
 * Describe the semantic viewport mode derived from the current size.
 *
 * This is intentionally coarser than raw pixel dimensions so layout code can
 * react to meaningful mode changes instead of every resize event.
 */
type SizeWatcherMode = {
	/**
	 * Store the coarse viewport orientation.
	 */
	orientation: SizeWatcherOrientation;

	/**
	 * Indicate that the viewport is meaningfully taller than it is wide.
	 */
	isPortrait: boolean;

	/**
	 * Indicate that the viewport is landscape, square, or near-square.
	 */
	isLandscape: boolean;

	/**
	 * Indicate that the viewport is portrait and narrow enough for compact
	 * portrait-specific UI.
	 */
	isNarrowPortrait: boolean;

	/**
	 * Store the coarse viewport width class.
	 */
	sizeClass: SizeWatcherSizeClass;
}

/**
 * Describe a boolean mode flag that can be queried by name.
 */
type SizeWatcherModeFlag =
	"isPortrait" |
	"isLandscape" |
	"isNarrowPortrait";

/**
 * Describe a query against the current semantic viewport mode.
 */
type SizeWatcherModeQuery = SizeWatcherModeFlag | Partial<SizeWatcherMode>;

interface SizeWatcher {
	/**
	 * Call this method to immediately measure the viewport and fire the
	 * current size to listeners.
	 */
	check(): void;

	/**
	 * Call this method to get the current viewport size.
	 */
	getSize(): SizeWatcherViewportSize;

	/**
	 * Call this method to get the current semantic viewport mode.
	 */
	getMode(): SizeWatcherMode;

	/**
	 * Query one or more semantic viewport mode properties.
	 *
	 * @param query - Specify a mode flag name or expected mode shape.
	 */
	matchesMode(query: SizeWatcherModeQuery): boolean;
}
