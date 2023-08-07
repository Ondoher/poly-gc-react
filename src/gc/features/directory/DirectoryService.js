import {Service} from '@polylith/core';
import React from 'react';
import Directory from './Directory.jsx'

class DirectoryService extends Service {
	constructor (registry) {
		super('directory', registry);
		this.implement(['ready', 'get', 'add', 'render', 'show', 'hide', 'crumbClick', 'sendVisibility']);
		this.directory = [];
	}

	ready () {
		this.listen('clicked', this.onCardClicked.bind(this))
		this.crumbs = this.registry.subscribe('bread-crumbs');
		this.pagesProvider = this.registry.subscribe('pages-provider');
		this.pagesProvider.listen('newView', this.onNewView.bind(this));
	}

	sendVisibility () {
		this.fire(this.visible ? 'show' : 'hide');
	}

	show () {
		this.visible = true;
	}

	hide () {
		this.visible = false;
	}

	get() {
	}

	onNewView(name) {
		if (name === 'main-pages') {
			this.pagesView = this.registry.subscribe('main-pages');
			this.pagesView.add('directory', 'directory');
			this.pagesView.show('directory');
		}
	}

	add(card) {
		card.service = this.registry.subscribe(card.serviceName);
		this.directory.push(card);
		if (this.rendered) this.fire('added', card)
	}

	crumbClick(id) {
		this.pagesView.show('directory');
	}

	onCardClicked(card) {
		card.service.invoke('clicked')
		this.crumbs.clear();
		this.crumbs.add('Directory', 'directory', 'directory');
	}

	async render() {
		this.rendered = true;
		return <Directory serviceName="directory" directory={this.directory} key="directory"/>
	}
}

new DirectoryService();
