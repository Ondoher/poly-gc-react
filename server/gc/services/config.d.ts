/**
 * Exposes server-local configuration values loaded from the ignored
 * `config/gc` directory.
 */
export interface ConfigService {
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
	 * @param name - dotted config path
	 * @param defaultValue - fallback returned only when the terminal leaf is missing
	 */
	get(name: string, defaultValue?: unknown): unknown;
}
