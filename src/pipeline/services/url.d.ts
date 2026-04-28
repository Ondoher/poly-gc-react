/**
 * Define the browser URL service contract for clean app routes.
 */
interface UrlService {
	/**
	 * Listen to URL service events.
	 *
	 * Events:
	 * - `popstate`: browser History API popstate occurred.
	 * - `changed`: URL-derived route details changed.
	 *
	 * @param eventName - Event name.
	 * @param callback - Event callback.
	 */
	listen(eventName: string, callback: (details: { pageSlug: string; segments: string[] }) => void): unknown;

	/**
	 * Return path segments after the app base path.
	 */
	getExtraPathSegments(): string[];

	/**
	 * Return the first path segment after the app base path.
	 */
	getPageSlug(): string;

	/**
	 * Build an app URL path for a page slug.
	 *
	 * @param slug - Page URL slug.
	 */
	pathForSlug(slug?: string): string;

	/**
	 * Push a page slug into browser history.
	 *
	 * @param slug - Page URL slug.
	 */
	pushPageSlug(slug: string): void;

	/**
	 * Replace the current browser history entry with a page slug.
	 *
	 * @param slug - Page URL slug.
	 */
	replacePageSlug(slug: string): void;
}
