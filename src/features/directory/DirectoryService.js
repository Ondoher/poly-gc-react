import {Service, registry} from '@polylith/core';
import React from 'react';
import Directory from './Directory'

class DirectoryService extends Service {
    constructor () {
        super('directory');
        this.implement(['ready', 'get', 'add', 'render', 'show', 'hide', 'crumbClick', 'sendVisibility']);
    }

    ready () {
        this.pagesService = registry.subscribe('main-pages');
        this.pagesService.add('directory', 'directory');
        this.pagesService.show('directory');
        this.listen('clicked', this.onCardClicked.bind(this))
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

    add(game) {
        this.fire('added', game)
    }

    play() {

    }

    onCardClicked() {

    }

    async render() {
        return React.createElement(Directory, {
            serviceName: 'directory',
            id: 'directory',
            key: 'diectory',
        }, []);
    }
}

new DirectoryService();
