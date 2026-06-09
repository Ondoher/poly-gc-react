export interface AppPage {
	id: string;
	label: string;
	urlSlug: string;
	route: string;
	order: number;
	controller: string;
}

export interface AppPagesService {
	/**
	 * Add or update a shell page registration.
	 */
	add(page: AppPage): void;

	/**
	 * Get registered pages in display order.
	 */
	get(): AppPage[];

	/**
	 * Get a page by id.
	 */
	getById(id: string): AppPage | null;

	/**
	 * Get a page by route.
	 */
	getByRoute(route: string): AppPage | null;

	/**
	 * Get a page by URL slug.
	 */
	getBySlug(slug: string): AppPage | null;
}
