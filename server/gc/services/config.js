import { Service } from "@polylith/core";
import { readFile } from 'node:fs/promises';
import * as path from 'node:path'

/**
 * Loads server-local configuration from the ignored `config/gc` directory and
 * exposes dotted-path lookups to other Polylith services.
 */
export class ConfigService extends Service {
	/**
	 * @param {import('@polylith/core').Registry} registry
	 */
	constructor(registry) {
		super('config', registry);

		this.implement(['start', 'get']);
		this.config = {};
	}

	/**
	 * Safely read and parse a JSON configuration file.
	 *
	 * Returns an empty object if the file is missing or invalid so the service
	 * can still start and callers can detect missing branches explicitly.
	 *
	 * @param {string} filename
	 * @returns {Promise<object>}
	 */
	async safeReadJSON(filename) {
		try {
			let json = await readFile(filename, 'utf-8');
			return JSON.parse(json);

		} catch (e) {
			console.warn(`unable to load or parse JSON file ${filename}`);
			console.warn(e.message);
			if (e.stack) {
				console.warn(e.stack);
			}

			return {}
		}
	}

	/**
	 * Resolve the environment-specific config filename.
	 *
	 * @returns {string}
	 */
	getConfigFilename() {
		let env = process.env.GC_ENV ?? process.env.NODE_ENV ?? 'dev';
		return path.normalize(path.join('config', 'gc', `config.${env}.json`));
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
	 * Returns the provided default value only when the parent branch exists and
	 * the terminal leaf is missing. If an intermediate branch is missing, this
	 * method returns `undefined` so callers can detect the absent branch.
	 *
	 * Examples:
	 * - if `mongo.login` exists but `mongo.login.uri` does not, then
	 *   `get('mongo.login.uri', 'hello')` returns `'hello'`
	 * - if `mongo` or `mongo.login` does not exist, then
	 *   `get('mongo.login.uri', 'hello')` returns `undefined`
	 *
	 * @param {string} name
	 * @param {*} [defaultValue]
	 * @returns {*}
	 */
	get(name, defaultValue) {
		var parts = name.split('.');
		var result = this.config;
		while (parts.length > 0) {
			let key = parts.shift();
			result = result[key];

			if (result === undefined) {
				if (parts.length === 0) {
					return defaultValue
				}
				return undefined;
			}
		}

		return result;
	}
}


new ConfigService();
