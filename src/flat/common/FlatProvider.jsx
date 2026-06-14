import React from 'react';
import FlatContext from './FlatContext.js';

/**
 * Provide Flat application services to React presentation components.
 *
 * @extends {React.Component<FlatProviderProps>}
 */
export default class FlatProvider extends React.Component {
	/**
	 * Render the context provider.
	 *
	 * @returns {React.ReactElement}
	 */
	render() {
		const contextValue = {
			...this.props.contextValue,
		};

		return (
			<FlatContext.Provider value={contextValue}>
				{this.props.children}
			</FlatContext.Provider>
		);
	}
}
