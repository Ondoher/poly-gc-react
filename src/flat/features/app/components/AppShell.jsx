import React from 'react';

/**
 * Render the Flat app shell.
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
		this.syncFromView();
	}

	componentWillUnmount() {
		if (this.props.appView && this.pagesUpdatedListener) {
			this.props.appView.unlisten('pages-updated', this.pagesUpdatedListener);
		}

		if (this.props.appView && this.pageMountedListener) {
			this.props.appView.unlisten('page-mounted', this.pageMountedListener);
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

	syncFromView() {
		const shellState = this.props.appView?.getShellState?.();

		if (!shellState) {
			return;
		}

		this.setState({
			activePageId: shellState.activePageId || '',
			pageComponent: shellState.pageComponent || null,
			pages: shellState.pages || [],
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
				<span className="app-shell-tabs-empty">No views registered</span>
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
				key: this.state.activePageId,
			});
		}

		return (
			<section className="flat-empty-shell">
				<h2>Flat shell mounted</h2>
				<p>No view feature is active yet.</p>
			</section>
		);
	}

	render() {
		return (
			<div className="app-shell">
				<header className="app-shell-header">
					<h1 className="app-shell-title">Flat</h1>
					<nav aria-label="Flat views" className="app-shell-tabs" role="tablist">
						{this.renderTabs()}
					</nav>
				</header>
				<main className="app-shell-body">
					{this.renderPageRegion()}
				</main>
			</div>
		);
	}
}
