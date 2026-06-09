import React from 'react';

export default class App extends React.Component {
	render() {
		return (
			<div className="flat-app">
				{this.props.children}
			</div>
		);
	}
}
