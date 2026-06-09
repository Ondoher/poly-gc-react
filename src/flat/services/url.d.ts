export interface UrlService {
	/**
	 * Get path segments after the flat app base path.
	 */
	getExtraPathSegments(): string[];

	/**
	 * Get the current page slug from the browser URL.
	 */
	getPageSlug(): string;

	/**
	 * Build a flat app path for a page slug.
	 */
	pathForSlug(slug?: string): string;

	/**
	 * Push a page slug into browser history.
	 */
	pushPageSlug(slug: string): void;

	/**
	 * Replace the current browser history entry with a page slug.
	 */
	replacePageSlug(slug: string): void;
}
