import { Service } from '@polylith/core';

export default class AppController extends Service {
	constructor(registry) {
		super('app-controller', registry);
		this.implement([
			'ready',
			'getPages',
			'getShellState',
			'getActiveTilesetId',
			'ensureActivePage',
			'requestPage',
			'requestTileset',
			'getComponent',
		]);
	}

	ready() {
		this.view = this.registry.subscribe('app-view');
		this.pages = this.registry.subscribe('app-pages');
		this.url = this.registry.subscribe('url');
		this.views = this.registry.subscribe('views');
		this.pipeline = this.registry.subscribe('server-model');
		this.activePageId = null;
		this.activePageComponent = null;
		this.tilesets = [];
		this.activeTilesetId = '';
		this.tilesetsLoading = false;
		this.registryReady = false;
		this.pages.listen('updated', this.onPagesUpdated.bind(this));
		this.pages.listen('page-added', this.onPageAvailable.bind(this));
		this.pages.listen('page-updated', this.onPageAvailable.bind(this));
		this.url.listen('changed', this.onUrlChanged.bind(this));
		this.views.listen('view-added', this.onViewAvailable.bind(this));
		this.registry.listen('ready', this.onRegistryReady.bind(this));
		this.reconcilePages();
		this.loadTilesets();
	}

	onPagesUpdated(pages) {
		this.fire('pages-updated', pages);

		if (!this.activePageId && pages.length > 0) {
			this.ensureActivePage();
		}
	}

	onUrlChanged() {
		const page = this.pageForCurrentUrl() || this.getPages()[0] || null;

		if (page) {
			this.requestPage(page.id, { history: 'none' });
		}
	}

	onPageAvailable(page) {
		if (this.pageForCurrentUrl()?.id === page.id && this.activePageId !== page.id) {
			this.requestPage(page.id, { history: 'none' });
			return;
		}

		this.reconcilePages(page.id);
	}

	onViewAvailable() {
		this.reconcilePages(this.activePageId);
	}

	onRegistryReady() {
		this.registryReady = true;
		this.reconcilePages(this.activePageId);
	}

	reconcilePages(preferredPageId = '') {
		const pages = this.getPages();

		this.fire('pages-updated', pages);
		this.ensureActivePage(preferredPageId);
	}

	ensureActivePage(preferredPageId = '') {
		if (this.activePageComponent && this.activePageId) {
			return this.pages.getById(this.activePageId);
		}

		const pages = this.getPages();

		if (pages.length === 0) {
			return null;
		}

		const preferredPage = preferredPageId
			? pages.find((page) => page.id === preferredPageId)
			: null;
		const urlSlug = this.url.getPageSlug();
		const urlPage = this.pageForCurrentUrl();

		if (urlSlug && !urlPage && !this.registryReady) {
			return null;
		}

		const candidates = [
			urlPage,
			preferredPage,
			this.activePageId ? pages.find((page) => page.id === this.activePageId) : null,
			...pages,
		].filter(Boolean);
		const tried = new Set();

		for (const page of candidates) {
			if (tried.has(page.id)) {
				continue;
			}

			tried.add(page.id);

			if (this.requestPage(page.id, { history: 'replace' })) {
				return page;
			}
		}

		return null;
	}

	getPages() {
		return this.pages.get();
	}

	pageForCurrentUrl() {
		const slug = this.url.getPageSlug();

		return slug
			? this.pages.getBySlug(slug)
			: null;
	}

	pageSlug(page) {
		return page.urlSlug || page.id;
	}

	getActiveTilesetId() {
		return this.activeTilesetId;
	}

	setTilesetState(result = {}) {
		const previousTilesetId = this.activeTilesetId;
		this.tilesets = result.sources || [];
		this.activeTilesetId = result.activeTilesetId || this.tilesets.find((tileset) => tileset.active)?.id || '';
		this.fire('tilesets-updated', this.tilesetState());

		if (this.activeTilesetId && previousTilesetId !== this.activeTilesetId && this.activePageId) {
			this.activePageComponent = null;
			this.requestPage(this.activePageId, { history: 'none' });
		}
	}

	tilesetState() {
		return {
			activeTilesetId: this.activeTilesetId,
			tilesets: this.tilesets,
			tilesetsLoading: this.tilesetsLoading,
		};
	}

	async loadTilesets() {
		this.tilesetsLoading = true;
		this.fire('tilesets-updated', this.tilesetState());

		try {
			this.setTilesetState(await this.pipeline.loadTilesets());
		} catch (error) {
			this.fire('tilesets-updated', {
				...this.tilesetState(),
				error: error.message,
			});
		} finally {
			this.tilesetsLoading = false;
			this.fire('tilesets-updated', this.tilesetState());
		}
	}

	getShellState(preferredPageId = '') {
		this.ensureActivePage(preferredPageId);

		return {
			activePageId: this.activePageId,
			pageComponent: this.activePageComponent,
			pages: this.getPages(),
			...this.tilesetState(),
		};
	}

	requestPage(pageId, options = {}) {
		const page = this.pages.getById(pageId);

		if (!page) {
			return null;
		}

		const pageController = this.registry.subscribe(page.controller);

		if (!pageController) {
			throw new Error(`Page controller "${page.controller}" is not registered for page "${page.id}".`);
		}

		if (this.activeTilesetId) {
			pageController.setTilesetId?.(this.activeTilesetId);
		}

		const component = pageController.mount({
			appController: this,
			page,
			tilesetId: this.activeTilesetId,
		});

		if (!component) {
			return null;
		}

		this.activePageId = page.id;
		this.activePageComponent = component;
		this.updateUrlForPage(page, options.history || 'push');
		this.fire('page-requested', page);
		this.fire('page-mounted', {
			component,
			page,
		});
		return page;
	}

	updateUrlForPage(page, historyMode) {
		if (historyMode === 'none') {
			return;
		}

		const slug = this.pageSlug(page);

		if (historyMode === 'replace') {
			this.url.replacePageSlug(slug);
			return;
		}

		this.url.pushPageSlug(slug);
	}

	async requestTileset(tilesetId) {
		if (!tilesetId || tilesetId === this.activeTilesetId) {
			return this.tilesetState();
		}

		this.tilesetsLoading = true;
		this.fire('tilesets-updated', this.tilesetState());

		try {
			this.setTilesetState(await this.pipeline.setActiveTileset(tilesetId));
		} catch (error) {
			this.fire('tilesets-updated', {
				...this.tilesetState(),
				error: error.message,
			});
		} finally {
			this.tilesetsLoading = false;
			this.fire('tilesets-updated', this.tilesetState());
		}

		return this.tilesetState();
	}

	getComponent(props = {}) {
		const shellState = this.getShellState();

		return this.view.getComponent({
			...props,
			activePageId: shellState.activePageId,
			pageComponent: shellState.pageComponent,
			pages: shellState.pages,
			registry: this.registry,
		});
	}
}

new AppController();
