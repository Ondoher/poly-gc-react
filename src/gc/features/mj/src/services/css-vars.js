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
		this.implement(["start", "ready", "precache", "get"]);

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
		let values = {};
		let requestedNames = Array.isArray(names) ? names : [];

		requestedNames.forEach(function(name) {
			let normalizedName = this.normalizeCssVarName(name);

			if (!normalizedName) {
				return;
			}

			let value = this.readCssVar(normalizedName);

			if (value === "") {
				return;
			}

			this.vars[normalizedName] = value;
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
		let normalizedName = this.normalizeCssVarName(name);

		if (!normalizedName) {
			return "";
		}

		if (Object.prototype.hasOwnProperty.call(this.vars, normalizedName)) {
			return this.vars[normalizedName];
		}

		let value = this.readCssVar(normalizedName);

		if (value !== "") {
			this.vars[normalizedName] = value;
		}

		return value;
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
		if (typeof window === "undefined" || typeof document === "undefined") {
			return "";
		}

		let root = document.documentElement;

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
