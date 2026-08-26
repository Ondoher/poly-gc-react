import { registry } from '@polylith/core';
import { installSharedConfigRoute } from './shared-config.js';

/**
 * Install the test route that proves deliberate cross-app registry sharing.
 *
 * @param {import('express').Express} _express - Receive the host Express application.
 * @param {import('express').Router} router - Own the simple-test routes.
 * @param {unknown} _app - Receive the Polylith application model.
 * @param {import('@polylith/core').Registry} sharedRegistry - Receive the CLI-owned registry.
 */
export default async function mainRouter(_express, router, _app, sharedRegistry) {
    if (!sharedRegistry) {
        throw new Error('Polylith did not provide the shared registry');
    }

    registry.attach('shared', sharedRegistry);
    installSharedConfigRoute(router);
}
