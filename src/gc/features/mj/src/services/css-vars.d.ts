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
	 * Cache one or more CSS custom-property values from one specific element.
	 *
	 * @param element - Specify the element whose computed custom properties should be read.
	 * @param names - Specify the CSS custom-property names to cache.
	 */
	precacheFromElement(element: Element | null, names: string[]): Record<string, string>;

	/**
	 * Return one CSS custom-property value.
	 *
	 * @param name - Specify the CSS custom-property name to read.
	 */
	get(name: string): string;

	/**
	 * Return one CSS custom-property value from one specific element.
	 *
	 * @param element - Specify the element whose computed custom properties should be read.
	 * @param name - Specify the CSS custom-property name to read.
	 */
	getFromElement(element: Element | null, name: string): string;

	/**
	 * Construct one plain object from a CSS-variable prefix plus a list of
	 * variable names.
	 *
	 * The variable names themselves define the nested object shape.
	 *
	 * @param descriptor - Describe the prefix and variable names to read.
	 * @param options - Control element scoping, default values, and number coercion.
	 */
	buildObject(
		descriptor: LayoutCssVarGroupDescriptor,
		options?: LayoutCssVarBuildOptions
	): Record<string, any>;
}
