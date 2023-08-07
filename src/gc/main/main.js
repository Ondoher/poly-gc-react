import { Service } from '@polylith/core';
import React from "react";
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

export default class MainView extends Service {
    constructor(registry) {
        super('main-view', registry);
        this.implement(['ready'])
    }

    async ready() {
        var domNode = document.getElementById('main-content');
        var root = createRoot(domNode);

        root.render(
			<React.StrictMode>
                <App registry={this.registry} />
			</React.StrictMode>
		);
    }
}

new MainView();
