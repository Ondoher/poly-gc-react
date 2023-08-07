import React from "react";
import GameCenterContext from 'common/GameCenterContext.js';

export default class Pages extends React.Component {
    static contextType = GameCenterContext;
	constructor (props) {
		super(props);

		this.serviceName = props.serviceName;
		this.state = {};
	}

	async updatePageStates() {
		var pages = this.state.pages;
		var currentPage = this.state.currentPage;

		if (this.previousPage) {
			let service = pages[this.previousPage] && pages[this.previousPage].service;
			if (service) {
				service.fire('hide');
			}

			this.previousPage = false;
		}

		if (currentPage) {
			let service = pages[currentPage] && pages[currentPage].service;
			if (!service) {
				return;
			}

			service.fire('show');
		}
	}

	async componentDidUpdate() {
		this.updatePageStates();
	}

	added(pages) {
		this.setState({pages: pages})
	}

	async getPageComponent(name, state={}) {
		state = {...state, ...this.state};

		var pages = state.pages || {};
		var page = pages[name];

		if (!page) {
			return false;
		}

		if (page.component) {
			return page.component
		}

		var component = await page.service.render();
		if (!component) {
			return false;
		}

		page.component = component;
		state = {...state, pages: pages}
		this.setState(state);

		return page.component;
	}

	async show(name) {
		var component = await this.getPageComponent(name);

		if (!component) {
			return;
		}

		this.previousPage = this.state.currentPage;

		this.setState({
			currentPage: name
		});
	}

	async componentDidMount() {
		var registry = this.context.registry;

		this.pagesView = registry.subscribe(this.serviceName);
		this.pagesView.listen('added', this.added.bind(this));
		this.pagesView.listen('showPage', this.show.bind(this));
		var viewState = this.pagesView.get();

		var state = {
			pages: viewState.pages,
			ready: true,
		}
		this.firstPage = viewState.current;

		if (this.firstPage) {
			state = {...state, currentPage: this.firstPage};
			this.getPageComponent(this.firstPage, state)
		}

		this.setState(state);
		this.updatePageStates();
}

	render() {
		if (!this.state.ready) return;

		var pages = this.state.pages || {};
		var childNames = Object.keys(pages);
		var children = [];

		childNames.forEach(function(child) {
			var page = pages[child];
			if (page.component) {
				children.push(page.component);
			}
		}, this);

		return (
			<div style={this.props.style} id={this.props.id} className={this.props.className} key={this.props.id}>
				{children}
			</div>
		)
	}
}
