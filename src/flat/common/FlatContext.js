import React from 'react';

/** @type {FlatContextValue} */
const defaultFlatContext = {
	app: {},
	animationLoop: null,
	registry: null,
};

const FlatContext = React.createContext(defaultFlatContext);

export default FlatContext;
