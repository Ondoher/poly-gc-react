/**
 * Describe props passed into the app-shell presentation component.
 */
type AppShellProps = {
	/**
	 * Carry the app-shell view service.
	 */
	appView?: AppViewService;

	/**
	 * Identify the currently active page.
	 */
	activePageId?: string;

	/**
	 * Carry the currently mounted page presentation component.
	 */
	pageComponent?: import('react').ReactNode;

	/**
	 * Carry registered app-shell pages for navigation.
	 */
	pages?: AppPageRecord[];

	/**
	 * Identify the active source tileset.
	 */
	activeTilesetId?: string;

	/**
	 * Carry manifest-backed source tilesets for the shell selector.
	 */
	tilesets?: Array<{ id: string; label?: string; active?: boolean }>;

	/**
	 * Indicate that tileset manifest state is loading.
	 */
	tilesetsLoading?: boolean;

	/**
	 * Carry additional app-shell bootstrap props.
	 */
	[key: string]: unknown;
};

/**
 * Define the service contract for the pipeline app-shell view.
 */
interface AppViewService {
	/**
	 * Return the current app-shell state.
	 *
	 * @param preferredPageId - Optionally prefer one page id.
	 */
	getShellState(preferredPageId?: string): {
		activePageId: string | null;
		pageComponent: import('react').ReactNode;
		pages: AppPageRecord[];
		activeTilesetId: string;
		tilesets: Array<{ id: string; label?: string; active?: boolean }>;
		tilesetsLoading: boolean;
	};

	/**
	 * Request activation of one registered app-shell page.
	 *
	 * @param pageId - Identify the page to activate.
	 */
	requestPage(pageId: string): AppPageRecord | null;

	/**
	 * Request activation of one manifest-backed tileset.
	 *
	 * @param tilesetId - Identify the tileset to activate.
	 */
	requestTileset(tilesetId: string): Promise<object>;

	/**
	 * Return the app-shell presentation component.
	 *
	 * @param props - Carry presentation props for the app shell.
	 */
	getComponent(props?: AppShellProps): import('react').ReactElement;
}
