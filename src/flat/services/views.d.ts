import type { ReactElement } from 'react';

export interface ViewsService {
	/**
	 * Register a view id to a view service name.
	 */
	add(viewId: string, serviceName: string): void;

	/**
	 * Get a React component from the registered view service.
	 */
	get(viewId: string, props?: Record<string, unknown>): ReactElement | null;

	/**
	 * Check whether a view id is registered.
	 */
	has(viewId: string): boolean;
}
