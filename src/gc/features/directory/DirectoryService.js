import {Service, registry} from '@polylith/core';
import React from 'react';
import Directory from './Directory'

class DirectoryService extends Service {
	constructor () {
		super('directory');
		this.implement(['ready', 'get', 'add', 'render', 'show', 'hide', 'crumbClick', 'sendVisibility']);
		this.directory = [];
	}

	ready () {
		this.pagesService = registry.subscribe('main-pages');
		this.pagesService.add('directory', 'directory');
		this.pagesService.show('directory');
		this.listen('clicked', this.onCardClicked.bind(this))
		this.crumbs = registry.subscribe('bread-crumbs');
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

	add(card) {
		card.service = registry.subscribe(card.serviceName);
		this.directory.push(card);
		if (this.rendered) this.fire('added', card)
	}

	crumbClick(id) {
		console.log('crumbClicked')
		this.pagesService.show('directory');
	}

	onCardClicked(card) {
		card.service.invoke('clicked')
		this.crumbs.clear();
		this.crumbs.add('Directory', 'directory', 'directory');
	}

	async render() {
		this.rendered = true;
		return React.createElement(Directory, {
			serviceName: 'directory',
			id: 'directory',
			key: 'diectory',
			directory: this.directory,
		}, []);
	}
}

new DirectoryService();
