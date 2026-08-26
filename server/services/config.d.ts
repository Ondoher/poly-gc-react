import { Registry, Service } from '@polylith/core';

/**
 * Load deployment-owned configuration and expose dotted-path lookups.
 */
export class ConfigService extends Service {
    constructor(registry: Registry, serverRoot: string);

    /**
     * Read a configuration value by dotted path.
     *
     * Return the provided default only when the terminal leaf is missing.
     * Return `undefined` when an intermediate branch is missing.
     *
     * @param name - Identify the dotted configuration path.
     * @param defaultValue - Supply the terminal fallback value.
     */
    get(name: string, defaultValue?: unknown): unknown;
}
