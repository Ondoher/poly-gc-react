import { Service } from '@polylith/core';

const DEFAULT_BASE_PATH = '/flat';

export default class UrlService extends Service {
	constructor(registry) {
		super('url', registry);
		this.implement([
			'ready',
			'getExtraPathSegments',
			'getPageSlug',
			'pathForSlug',
			'pushPageSlug',
			'replacePageSlug',
		]);
	}

	ready() {
		this.basePath = DEFAULT_BASE_PATH;

		if (typeof window !== 'undefined') {
			window.addEventListener('popstate', this.onPopState.bind(this));
		}
	}

	onPopState() {
		const details = {
			pageSlug: this.getPageSlug(),
			segments: this.getExtraPathSegments(),
		};

		this.fire('popstate', details);
		this.fire('changed', details);
	}

	getExtraPathSegments() {
		if (typeof window === 'undefined') {
			return [];
		}

		const pathname = window.location.pathname || '';
		const normalizedBase = this.normalizePath(this.basePath);
		const normalizedPath = this.normalizePath(pathname);
		const relativePath = normalizedPath === normalizedBase
			? ''
			: normalizedPath.startsWith(`${normalizedBase}/`)
				? normalizedPath.slice(normalizedBase.length + 1)
				: normalizedPath.replace(/^\/+/, '');

		return relativePath
			.split('/')
			.map((segment) => decodeURIComponent(segment))
			.filter(Boolean);
	}

	getPageSlug() {
		return this.getExtraPathSegments()[0] || '';
	}

	pathForSlug(slug = '') {
		const safeSlug = this.cleanSlug(slug);

		return safeSlug
			? `${this.basePath}/${encodeURIComponent(safeSlug)}`
			: `${this.basePath}/`;
	}

	pushPageSlug(slug) {
		this.writeHistory(slug, 'pushState');
	}

	replacePageSlug(slug) {
		this.writeHistory(slug, 'replaceState');
	}

	writeHistory(slug, methodName) {
		if (typeof window === 'undefined' || !window.history?.[methodName]) {
			return;
		}

		const nextPath = this.pathForSlug(slug);

		if (window.location.pathname === nextPath) {
			return;
		}

		window.history[methodName]({}, '', nextPath);
	}

	cleanSlug(slug = '') {
		return String(slug || '').replace(/^\/+|\/+$/g, '');
	}

	normalizePath(pathname = '') {
		const normalized = `/${String(pathname || '').replace(/^\/+|\/+$/g, '')}`;

		return normalized === '/' ? '' : normalized;
	}
}

new UrlService();
