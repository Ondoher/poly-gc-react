import React from 'react';

/**
 * Render the pipeline app shell.
 *
 * @extends {React.Component<AppShellProps>}
 */
export default class AppShell extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			activePageId: props.activePageId || '',
			pageComponent: props.pageComponent || null,
			pages: props.pages || [],
			activeTilesetId: props.activeTilesetId || '',
			tilesets: props.tilesets || [],
			tilesetsLoading: props.tilesetsLoading || false,
		};
	}

	componentDidMount() {
		if (!this.props.appView) {
			return;
		}

		this.pagesUpdatedListener = this.props.appView.listen(
			'pages-updated',
			this.onPagesUpdated.bind(this),
		);
		this.pageMountedListener = this.props.appView.listen(
			'page-mounted',
			this.onPageMounted.bind(this),
		);
		this.tilesetsUpdatedListener = this.props.appView.listen(
			'tilesets-updated',
			this.onTilesetsUpdated.bind(this),
		);
		this.syncFromView();
	}

	componentWillUnmount() {
		if (this.props.appView && this.pagesUpdatedListener) {
			this.props.appView.unlisten('pages-updated', this.pagesUpdatedListener);
		}

		if (this.props.appView && this.pageMountedListener) {
			this.props.appView.unlisten('page-mounted', this.pageMountedListener);
		}

		if (this.props.appView && this.tilesetsUpdatedListener) {
			this.props.appView.unlisten('tilesets-updated', this.tilesetsUpdatedListener);
		}
	}

	onPagesUpdated(pages) {
		this.setState({ pages });
	}

	onPageMounted({ component, page }) {
		this.setState({
			activePageId: page.id,
			pageComponent: component,
		});
	}

	onTilesetsUpdated(details = {}) {
		this.setState({
			activeTilesetId: details.activeTilesetId || '',
			tilesets: details.tilesets || [],
			tilesetsLoading: details.tilesetsLoading || false,
		});
	}

	syncFromView() {
		const shellState = this.props.appView?.getShellState?.();

		if (!shellState) {
			return;
		}

		this.setState({
			activePageId: shellState.activePageId || '',
			pageComponent: shellState.pageComponent || null,
			pages: shellState.pages || [],
			activeTilesetId: shellState.activeTilesetId || '',
			tilesets: shellState.tilesets || [],
			tilesetsLoading: shellState.tilesetsLoading || false,
		});
	}

	onPageClick(page, event) {
		event.preventDefault();

		const requestedPage = this.props.appView?.requestPage(page.id);

		if (!requestedPage) {
			return;
		}

		this.setState({
			activePageId: requestedPage.id,
		});
	}

	onTilesetChange(event) {
		this.props.appView?.requestTileset(event.target.value);
	}

	getTabLabel(page) {
		return page.label || page.id;
	}

	getTabHref(page) {
		return page.route || `#${page.id}`;
	}

	renderTabs() {
		const pages = this.state.pages;

		if (pages.length === 0) {
			return (
				<span className="app-shell-tabs-empty">No pages registered</span>
			);
		}

		return pages.map((page) => {
			const isActive = page.id === this.state.activePageId;

			return (
				<a
					aria-selected={isActive}
					className={isActive ? 'active' : ''}
					href={this.getTabHref(page)}
					key={page.id}
					onClick={this.onPageClick.bind(this, page)}
					role="tab"
				>
					{this.getTabLabel(page)}
				</a>
			);
		});
	}

	renderPageRegion() {
		if (this.state.pageComponent) {
			return React.cloneElement(this.state.pageComponent, {
				key: `${this.state.activePageId}:${this.state.activeTilesetId}`,
			});
		}

		return (
			<section className="dummy-shell">
				<h2>Pipeline shell mounted</h2>
				<p>No page feature is active yet.</p>
			</section>
		);
	}

	renderTilesetSelector() {
		const tilesets = this.state.tilesets;

		return (
			<label className="app-shell-tileset">
				<span>Tileset</span>
				<select
					value={this.state.activeTilesetId}
					disabled={this.state.tilesetsLoading || tilesets.length === 0}
					onChange={this.onTilesetChange.bind(this)}
				>
					{tilesets.length === 0 ? (
						<option value="">No tilesets</option>
					) : null}
					{tilesets.map((tileset) => (
						<option key={tileset.id} value={tileset.id}>
							{tileset.label || tileset.id}
						</option>
					))}
				</select>
			</label>
		);
	}

	render() {
		return (
			<div className="app-shell">
				<header className="app-shell-header">
					<h1 className="app-shell-title">Pipeline</h1>
					<nav aria-label="Pipeline pages" className="app-shell-tabs" role="tablist">
						{this.renderTabs()}
					</nav>
					{this.renderTilesetSelector()}
				</header>
				<main className="app-shell-body">
					{this.renderPageRegion()}
				</main>
			</div>
		);
	}
}
