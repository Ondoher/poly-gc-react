import { Service } from '@polylith/core';

export default class AppPagesService extends Service {
	constructor(registry) {
		super('app-pages', registry);
		this.implement(['start', 'add', 'get', 'getById', 'getByRoute', 'getBySlug']);
	}

	start() {
		this.pages = [];
	}

	add(page) {
		const nextPage = {
			order: 0,
			urlSlug: page.id,
			...page,
		};
		const existingIndex = this.pages.findIndex((candidate) => candidate.id === nextPage.id);

		if (existingIndex === -1) {
			this.pages.push(nextPage);
			this.fire('page-added', nextPage);
		} else {
			this.pages[existingIndex] = {
				...this.pages[existingIndex],
				...nextPage,
			};
			this.fire('page-updated', this.pages[existingIndex]);
		}

		this.fire('updated', this.get());
	}

	get() {
		return [...this.pages].sort((left, right) => (
			left.order === right.order
				? String(left.id || '').localeCompare(String(right.id || ''))
				: left.order - right.order
		));
	}

	getById(id) {
		return this.pages.find((page) => page.id === id) || null;
	}

	getByRoute(route) {
		return this.pages.find((page) => page.route === route) || null;
	}

	getBySlug(slug) {
		return this.pages.find((page) => page.urlSlug === slug) || null;
	}
}

new AppPagesService();
