import React from 'react';
import Pages from '../components/pages/Pages';
import PagesService from '../components/pages/PagesService';
import BreadCrumbs from '../features/bread-crumbs/index'

new PagesService('main-pages');

export default class App extends React.Component {
	constructor(props) {
		super(props);
	}

	componentDidMount() {
	}

	render () {
		return (
			<React.Fragment>
				<BreadCrumbs />
				<Pages id="pages" serviceName="main-pages" className="pages"/>
			</React.Fragment>
		)
	}
} 
