import { Service } from '@polylith/core';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Load server-local configuration and expose dotted-path lookups to apps.
 */
export class ConfigService extends Service {
    /**
     * @param {import('@polylith/core').Registry} registry - Own this service.
     * @param {string} serverRoot - Locate deployment-owned configuration.
     */
    constructor(registry, serverRoot) {
        super('config', registry);

        this.implement(['start', 'get']);
        this.config = {};
        this.serverRoot = serverRoot;
    }

    /**
     * Safely read and parse a JSON configuration file.
     *
     * Return an empty object if the file is missing or invalid so the service
     * can still start and callers can detect missing branches explicitly.
     *
     * @param {string} filename - Identify the JSON file to read.
     * @returns {Promise<object>} Return the parsed configuration object.
     */
    async safeReadJSON(filename) {
        try {
            let json = await readFile(filename, 'utf-8');
            return JSON.parse(json);
        } catch (error) {
            console.warn(`unable to load or parse JSON file ${filename}`);
            console.warn(error.message);
            if (error.stack) {
                console.warn(error.stack);
            }

            return {};
        }
    }

    /**
     * Resolve the environment-specific config filename.
     *
     * @returns {string} Return the normalized configuration filename.
     */
    getConfigFilename() {
        let env = process.env.GC_ENV ?? process.env.NODE_ENV ?? 'dev';
        return path.normalize(path.join(
            this.serverRoot,
            'config',
            'gc',
            `config.${env}.json`
        ));
    }

    /**
     * Load the current environment's config file into memory.
     *
     * @returns {Promise<void>}
     */
    async start() {
        let filename = this.getConfigFilename();
        this.config = await this.safeReadJSON(filename);
    }

    /**
     * Read a configuration value by dotted path.
     *
     * Return the provided default value only when the parent branch exists and
     * the terminal leaf is missing. Return `undefined` when an intermediate
     * branch is missing.
     *
     * @param {string} name - Identify the dotted configuration path.
     * @param {*} [defaultValue] - Supply the terminal fallback value.
     * @returns {*} Return the configured value, fallback, or `undefined`.
     */
    get(name, defaultValue) {
        var parts = name.split('.');
        var result = this.config;

        while (parts.length > 0) {
            let key = parts.shift();
            result = result[key];

            if (result === undefined) {
                if (parts.length === 0) {
                    return defaultValue;
                }

                return undefined;
            }
        }

        return result;
    }
}
