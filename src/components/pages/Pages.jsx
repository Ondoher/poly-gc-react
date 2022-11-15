import React from "react";
import {registry} from '@polylith/core';

export default class Pages extends React.Component {
	constructor (props) {
		super(props);

		this.serviceName = props.serviceName;
		this.pagesService = registry.subscribe(this.serviceName);
		this.pagesService.listen('added', this.added.bind(this));
		this.pagesService.listen('showPage', this.show.bind(this));
		var state = this.pagesService.get();
		this.firstPage = state.current;

		this.state = {
			pages: state.pages,
		};
	}

	async updatePageStates() {
		var pages = this.state.pages;
		var currentPage = this.state.currentPage;
		if (this.previousPage) {
			let service = pages[this.previousPage] && pages[this.previousPage].service;
			if (!service) {
				return;
			}

			service.fire('hide');
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

	async componentDidMount() {
		if (this.firstPage) {
			await this.getPageComponent(this.firstPage);

			this.setState({currentPage: this.firstPage});
		}

		this.updatePageStates();
	}

	async componentDidUpdate() {
		this.updatePageStates();
	}

	added(pages) {
		this.setState({pages: pages})
	}

	async getPageComponent(name) {
		var pages = this.state.pages;
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
		this.setState({pages: pages});

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

	render() {
		var pages = this.state.pages;
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
