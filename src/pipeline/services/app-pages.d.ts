/**
 * Describe one app-shell page registration.
 */
type AppPageRecord = {
	/**
	 * Identify the page registration.
	 */
	id: string;

	/**
	 * Label the page in app-shell navigation.
	 */
	label?: string;

	/**
	 * Match the browser route used to activate the page.
	 */
	route?: string;

	/**
	 * Match the first clean URL segment after the pipeline base route.
	 */
	urlSlug?: string;

	/**
	 * Sort the page within app-shell navigation.
	 */
	order?: number;

	/**
	 * Name the controller service that owns the page.
	 */
	controller?: string;

	/**
	 * Carry page-feature-specific registration details.
	 */
	[key: string]: unknown;
};

/**
 * Define the service contract for app-shell page registration.
 */
interface AppPagesService {
	/**
	 * Register or update one app-shell page.
	 *
	 * Fires `page-added` for new pages, `page-updated` for existing pages,
	 * and `updated` with the sorted full page list.
	 *
	 * @param page - Describe the page feature registration.
	 */
	add(page: AppPageRecord): void;

	/**
	 * Return registered app-shell pages sorted for navigation.
	 */
	get(): AppPageRecord[];

	/**
	 * Return the page registered with the given id.
	 *
	 * @param id - Identify the registered page.
	 */
	getById(id: string): AppPageRecord | null;

	/**
	 * Return the page registered for the given route.
	 *
	 * @param route - Match the registered route.
	 */
	getByRoute(route: string): AppPageRecord | null;

	/**
	 * Return the page registered for the given URL slug.
	 *
	 * @param slug - Match the first clean URL segment after the pipeline base.
	 */
	getBySlug(slug: string): AppPageRecord | null;
}
