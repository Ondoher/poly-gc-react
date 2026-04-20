import { Service, Registry } from "@polylith/core";

const CSS_READY_VAR = "--mj-css-ready";
const CSS_READY_VALUE = "1";
const CSS_READY_POLL_MS = 20;
const CSS_READY_TIMEOUT_MS = 3000;

/**
 * Cache computed MJ CSS custom properties for synchronous lookup after CSS is ready.
 */
export default class CssVarsService extends Service {
	/**
	 * @param {Registry} [registry] - Manage service lookup and registration.
	 */
	constructor(registry) {
		super("mj:css-vars", registry);
		this.implement([
			"start",
			"ready",
			"precache",
			"precacheFromElement",
			"get",
			"getFromElement",
			"buildObject",
		]);

		/**
		 * Store the cached CSS custom-property values.
		 *
		 * @type {Record<string, string>}
		 */
		this.vars = {};
	}

	/**
	 * Call this method to wait for the MJ stylesheet sentinel before the service becomes ready.
	 *
	 * @returns {Promise<Record<string, string>>} Return the initialized CSS-variable cache.
	 */
	async start() {
		this.vars = {};
		await this.waitForCssReady();
		return {...this.vars};
	}

	/**
	 * Call this method when Polylith marks the service as ready for use.
	 */
	ready() {
	}

	/**
	 * Call this method to cache one or more CSS custom-property values.
	 *
	 * @param {string[]} names - Specify the CSS custom-property names to cache.
	 * @returns {Record<string, string>} Return the cached values for the requested names.
	 */
	precache(names) {
		return this.precacheFromElement(null, names);
	}

	/**
	 * Call this method to cache one or more CSS custom-property values from one
	 * specific element.
	 *
	 * Element-scoped values are returned directly rather than being stored in the
	 * root cache, because the same variable name may resolve differently on
	 * different elements.
	 *
	 * @param {Element | null} element - Specify the element whose computed custom properties should be read.
	 * @param {string[]} names - Specify the CSS custom-property names to cache.
	 * @returns {Record<string, string>} Return the cached values for the requested names.
	 */
	precacheFromElement(element, names) {
		let values = {};
		let requestedNames = Array.isArray(names) ? names : [];

		requestedNames.forEach(function(name) {
			let normalizedName = this.normalizeCssVarName(name);

			if (!normalizedName) {
				return;
			}

			let value = this.readCssVarFromElement(element, normalizedName);

			if (value === "") {
				return;
			}

			if (!element) {
				this.vars[normalizedName] = value;
			}
			values[normalizedName] = value;
		}, this);

		return values;
	}

	/**
	 * Call this method to get one CSS custom-property value.
	 *
	 * @param {string} name - Specify the CSS custom-property name to read.
	 * @returns {string} Return the cached value or the current computed value when available.
	 */
	get(name) {
		return this.getFromElement(null, name);
	}

	/**
	 * Call this method to get one CSS custom-property value from one specific
	 * element.
	 *
	 * Root reads continue to use the shared cache. Element-scoped reads bypass the
	 * shared cache because they may vary by element instance.
	 *
	 * @param {Element | null} element - Specify the element whose computed custom properties should be read.
	 * @param {string} name - Specify the CSS custom-property name to read.
	 * @returns {string} Return the cached value or the current computed value when available.
	 */
	getFromElement(element, name) {
		let normalizedName = this.normalizeCssVarName(name);

		if (!normalizedName) {
			return "";
		}

		if (!element && Object.prototype.hasOwnProperty.call(this.vars, normalizedName)) {
			return this.vars[normalizedName];
		}

		let value = this.readCssVarFromElement(element, normalizedName);

		if (!element && value !== "") {
			this.vars[normalizedName] = value;
		}

		return value;
	}

	/**
	 * Call this method to construct one plain object from a CSS-variable prefix
	 * plus a list of variable names.
	 *
	 * The provided variable names are relative to the shared prefix. The prefix
	 * is added when reading the CSS variables, but it is not included in the
	 * derived object shape.
	 *
	 * For example, with a prefix of `tiny`, the name `number-size-width` reads
	 * `--tiny-number-size-width` and contributes `result.size.width`.
	 *
	 * @param {LayoutCssVarGroupDescriptor} descriptor - Describe the shared prefix and relative variable names to read.
	 * @param {LayoutCssVarBuildOptions} [options] - Control element scoping and number coercion.
	 * @returns {Record<string, any>} Return the constructed object.
	 */
	buildObject(descriptor = {}, options = {}) {
		let prefix = typeof descriptor.prefix === "string"
			? this.normalizeCssVarPrefix(descriptor.prefix)
			: "";
		let names = Array.isArray(descriptor.names)
			? descriptor.names
			: [];
		let element = options.element || null;
		let coerceNumbers = options.coerceNumbers !== false;
		let defaults = options.defaults && typeof options.defaults === "object"
			? options.defaults
			: {};

		return this.buildObjectFromNames(names, {
			prefix,
			element,
			coerceNumbers,
			defaults,
		});
	}

	/**
	 * Call this method to construct one plain object from a list of CSS-variable
	 * names whose shared prefix is added when reading the CSS variables.
	 *
	 * Names may optionally start with one simple type specifier such as
	 * `number` or `string`. The type specifier is used for value coercion but is
	 * not included in the output object path.
	 *
	 * @param {string[]} names - Specify the CSS-variable names relative to the prefix.
	 * @param {{
	 * 	prefix: string,
	 * 	element: Element | null,
	 * 	coerceNumbers: boolean,
	 * 	defaults: Record<string, any>,
	 * }} context - Specify the active build context.
	 * @returns {Record<string, any>}
	 */
	buildObjectFromNames(names, context) {
		return names.reduce(function(result, name) {
			let normalizedPath = this.normalizeCssVarObjectPath(name);

			if (!normalizedPath) {
				return result;
			}

			let segments = normalizedPath.split("-");
			let typeSpecifier = this.extractCssVarTypeSpecifier(segments[0]);
			let objectPath = typeSpecifier ? segments.slice(1) : segments.slice(0);

			if (objectPath.length === 0) {
				return result;
			}

			let variableName = `${context.prefix}${normalizedPath}`;
			let rawValue = context.element
				? this.getFromElement(context.element, variableName)
				: this.get(variableName);
			let defaultValue = this.getNestedValue(context.defaults, objectPath);

			if (rawValue === "" || typeof rawValue === "undefined") {
				this.setNestedValue(result, objectPath, defaultValue);
				return result;
			}

			let value = this.coerceCssVarValueByType(rawValue, {
				typeSpecifier,
				coerceNumbers: context.coerceNumbers,
			});

			this.setNestedValue(result, objectPath, value);
			return result;
		}.bind(this), {});
	}

	/**
	 * Call this method to wait until the MJ CSS readiness sentinel becomes available.
	 *
	 * @returns {Promise<void>} Return when the sentinel value is available or the wait times out.
	 */
	async waitForCssReady() {
		let startedAt = Date.now();

		while (Date.now() - startedAt < CSS_READY_TIMEOUT_MS) {
			let value = this.readCssVar(CSS_READY_VAR);

			if (value === CSS_READY_VALUE) {
				return;
			}

			await this.wait(CSS_READY_POLL_MS);
		}

		console.warn(
			`mj:css-vars timed out waiting for ${CSS_READY_VAR}=${CSS_READY_VALUE}`
		);
	}

	/**
	 * Call this method to read one computed CSS custom-property value from the document root.
	 *
	 * @param {string} name - Specify the CSS custom-property name to read.
	 * @returns {string} Return the computed CSS custom-property value or an empty string when unavailable.
	 */
	readCssVar(name) {
		return this.readCssVarFromElement(null, name);
	}

	/**
	 * Call this method to read one computed CSS custom-property value from one
	 * specific element or from the document root when no element is provided.
	 *
	 * @param {Element | null} element - Specify the element whose computed custom properties should be read.
	 * @param {string} name - Specify the CSS custom-property name to read.
	 * @returns {string} Return the computed CSS custom-property value or an empty string when unavailable.
	 */
	readCssVarFromElement(element, name) {
		if (typeof window === "undefined" || typeof document === "undefined") {
			return "";
		}

		let root = element || document.documentElement;

		if (!root) {
			return "";
		}

		return window.getComputedStyle(root).getPropertyValue(name).trim();
	}

	/**
	 * Call this method to normalize one CSS custom-property name to the `--name` form.
	 *
	 * @param {string} name - Specify the CSS custom-property name to normalize.
	 * @returns {string} Return the normalized CSS custom-property name or an empty string when invalid.
	 */
	normalizeCssVarName(name) {
		if (typeof name !== "string") {
			return "";
		}

		let trimmed = name.trim();

		if (!trimmed) {
			return "";
		}

		return trimmed.startsWith("--") ? trimmed : `--${trimmed}`;
	}

	/**
	 * Call this method to normalize one CSS-variable prefix so it can be safely
	 * joined with dashed variable names.
	 *
	 * Examples:
	 *
	 * - `tiny` => `--tiny-`
	 * - `--tiny` => `--tiny-`
	 * - `--tiny-` => `--tiny-`
	 *
	 * @param {string} prefix - Specify the CSS-variable prefix to normalize.
	 * @returns {string}
	 */
	normalizeCssVarPrefix(prefix) {
		let normalizedName = this.normalizeCssVarName(prefix);

		if (!normalizedName) {
			return "";
		}

		return normalizedName.endsWith("-")
			? normalizedName
			: `${normalizedName}-`;
	}

	/**
	 * Call this method to normalize one object-path variable name.
	 *
	 * @param {string} name - Specify the variable name relative to the prefix.
	 * @returns {string}
	 */
	normalizeCssVarObjectPath(name) {
		if (typeof name !== "string") {
			return "";
		}

		return name.trim().replace(/^-+/, "").replace(/-+$/, "");
	}

	/**
	 * Call this method to extract one supported type specifier from a path segment.
	 *
	 * @param {string} segment - Specify the first path segment to inspect.
	 * @returns {"number" | "string" | "boolean" | null}
	 */
	extractCssVarTypeSpecifier(segment) {
		if (segment === "number" || segment === "string" || segment === "boolean") {
			return segment;
		}

		return null;
	}

	/**
	 * Call this method to coerce one CSS-variable value using an optional
	 * explicit type specifier.
	 *
	 * @param {string} rawValue - Specify the raw CSS-variable value.
	 * @param {{typeSpecifier: string | null, coerceNumbers: boolean}} options - Specify coercion options.
	 * @returns {string | number | boolean}
	 */
	coerceCssVarValueByType(rawValue, options) {
		let trimmed = typeof rawValue === "string" ? rawValue.trim() : rawValue;

		if (options.typeSpecifier === "string") {
			return typeof trimmed === "string" ? trimmed : String(trimmed);
		}

		if (options.typeSpecifier === "number") {
			return Number.parseFloat(trimmed);
		}

		if (options.typeSpecifier === "boolean") {
			return trimmed === "true" || trimmed === "1";
		}

		return options.coerceNumbers
			? this.coerceCssVarValue(rawValue)
			: rawValue;
	}

	/**
	 * Call this method to read one nested default value from an object path.
	 *
	 * @param {Record<string, any>} target - Specify the object to inspect.
	 * @param {string[]} path - Specify the nested object path.
	 * @returns {any}
	 */
	getNestedValue(target, path) {
		return path.reduce(function(current, segment) {
			if (!current || typeof current !== "object") {
				return undefined;
			}

			return Object.prototype.hasOwnProperty.call(current, segment)
				? current[segment]
				: undefined;
		}, target);
	}

	/**
	 * Call this method to assign one nested object-path value.
	 *
	 * @param {Record<string, any>} target - Specify the object to update.
	 * @param {string[]} path - Specify the nested object path.
	 * @param {any} value - Specify the value to assign.
	 * @returns {Record<string, any>}
	 */
	setNestedValue(target, path, value) {
		if (!path.length) {
			return target;
		}

		let current = target;

		path.forEach(function(segment, index) {
			let isLeaf = index === path.length - 1;

			if (isLeaf) {
				current[segment] = value;
				return;
			}

			if (!current[segment] || typeof current[segment] !== "object") {
				current[segment] = {};
			}

			current = current[segment];
		});

		return target;
	}

	/**
	 * Call this method to convert one CSS custom-property value into a more
	 * useful JS value when possible.
	 *
	 * @param {string} rawValue - Specify the CSS custom-property value to normalize.
	 * @returns {string | number}
	 */
	coerceCssVarValue(rawValue) {
		if (typeof rawValue !== "string") {
			return rawValue;
		}

		let trimmed = rawValue.trim();

		if (trimmed === "") {
			return "";
		}

		if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
			return Number.parseFloat(trimmed);
		}

		return trimmed;
	}

	/**
	 * Call this method to wait for a short polling duration.
	 *
	 * @param {number} durationMs - Specify the time to wait in milliseconds.
	 * @returns {Promise<void>} Return when the delay has elapsed.
	 */
	wait(durationMs) {
		return new Promise(function(resolve) {
			setTimeout(resolve, durationMs);
		});
	}
}

new CssVarsService();
