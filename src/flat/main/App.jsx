import React from 'react';
import FlatProvider from '../common/FlatProvider.jsx';

/**
 * Provide Flat application services to React.
 *
 * @extends {React.Component<FlatAppProps>}
 */
export default class App extends React.Component {
	/**
	 * Initialize app services from the registry.
	 *
	 * @param {FlatAppProps} props - Carry app bootstrap props.
	 */
	constructor(props) {
		super(props);

		this.registry = props.registry;
		this.animationLoop = this.registry.subscribe('animation-loop');
	}

	/**
	 * Render the app provider and children.
	 *
	 * @returns {React.ReactElement}
	 */
	render() {
		const contextValue = {
			app: {
				id: 'flat',
			},
			animationLoop: this.animationLoop,
			registry: this.registry,
		};

		return (
			<FlatProvider contextValue={contextValue}>
				<div className="flat-app">
					{this.props.children}
				</div>
			</FlatProvider>
		);
	}
}
