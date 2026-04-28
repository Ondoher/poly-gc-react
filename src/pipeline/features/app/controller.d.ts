/**
 * Define the service contract for the pipeline app shell.
 */
interface AppControllerService {
	/**
	 * Return registered app-shell pages sorted for navigation.
	 */
	getPages(): AppPageRecord[];

	/**
	 * Return the current app-shell state, activating an available page first
	 * when needed.
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
	 * Return the active manifest-backed tileset id.
	 */
	getActiveTilesetId(): string;

	/**
	 * Activate the default page when no page is active.
	 *
	 * @param preferredPageId - Optionally prefer one page id.
	 */
	ensureActivePage(preferredPageId?: string): AppPageRecord | null;

	/**
	 * Request activation of one registered app-shell page.
	 *
	 * @param pageId - Identify the page to activate.
	 */
	requestPage(pageId: string, options?: { history?: 'push' | 'replace' | 'none' }): AppPageRecord | null;

	/**
	 * Request activation of one manifest-backed tileset.
	 *
	 * @param tilesetId - Identify the tileset to activate.
	 */
	requestTileset(tilesetId: string): Promise<object>;

	/**
	 * Return the app-shell presentation component for initial mounting.
	 *
	 * @param props - Carry bootstrap props for the app shell.
	 */
	getComponent(props?: AppShellProps): import('react').ReactElement;
}
