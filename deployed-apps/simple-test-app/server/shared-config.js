import { registry } from '@polylith/core';

/**
 * Install a route backed by a service published through the attached registry.
 *
 * This module deliberately receives neither registry from the server entry point.
 * It retrieves the CLI-owned registry through the app's own global registry.
 *
 * @param {import('express').Router} router - Own the simple-test routes.
 */
export function installSharedConfigRoute(router) {
    const sharedRegistry = registry.getAttached('shared');

    if (!sharedRegistry) {
        throw new Error('The shared registry is not attached');
    }

    const config = sharedRegistry.subscribe('config');

    if (!config) {
        throw new Error('GC did not publish its config service');
    }

    router.get('/api/shared-config', (_request, response) => {
        response.json({
            database: config.get('mongo.db'),
        });
    });
}
