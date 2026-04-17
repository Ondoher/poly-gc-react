/**
 * Define the exported service contract for the Mahjongg CSS custom-property cache.
 */
export interface CssVarsService {
	/**
	 * Cache one or more CSS custom-property values.
	 *
	 * @param names - Specify the CSS custom-property names to cache.
	 */
	precache(names: string[]): Record<string, string>;

	/**
	 * Return one CSS custom-property value.
	 *
	 * @param name - Specify the CSS custom-property name to read.
	 */
	get(name: string): string;
}
