import type { ReactElement } from 'react';

export interface MainView {
	/**
	 * Render the supplied app component into the root DOM node.
	 */
	render(component: ReactElement): void;
}
