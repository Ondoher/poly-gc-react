import React from 'react';
import GameCenterContext from 'common/GameCenterContext.js';

export default class App extends React.Component {
	constructor(props) {
		super(props);
		this.registry = this.props.registry;
	}

	render () {
		var breadCrumbs = this.registry.subscribe('bread-crumbs');
		var pagesService = this.registry.subscribe('pages-provider');

		var crumbs = breadCrumbs.getComponent();
		var view = pagesService.getView('main-pages');
		var pages = view.getComponent()

		var contextValue = {
			registry: this.registry,
			mainPages: view,
		}

		return (
			<GameCenterContext.Provider value={contextValue}>
				<React.Fragment>
					{crumbs}
					{pages}
				</React.Fragment>
			</GameCenterContext.Provider>
		)
	}
}
