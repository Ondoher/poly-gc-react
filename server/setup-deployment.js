import { ConfigService } from './services/config.js';

/**
 * Register and start the services owned by this deployment host.
 *
 * Resolving this function tells Polylith that shared services are ready and
 * application routers may initialize.
 *
 * @param {{
 *     sharedRegistry: import('@polylith/core').Registry,
 *     serverRoot: string,
 *     config: object
 * }} context - Carry the deployment setup context supplied by Polylith.
 * @returns {Promise<void>}
 */
export default async function setupDeployment({ sharedRegistry, serverRoot }) {
    new ConfigService(sharedRegistry, serverRoot);
    await sharedRegistry.start();
}
