import { Service } from "@polylith/core";

const SOCKET_IO_CLIENT_SCRIPT = "/socket.io/socket.io.js";

export default class StreamService extends Service {
	constructor(registry) {
		super("stream", registry);
		this.implement(["start", "namespace", "on", "off", "send", "get"]);
	}

	/**
	 * Prepare namespace tracking. The Socket.IO client script is loaded lazily
	 * when the first namespace is requested.
	 */
	start() {
		this.namespaces = {};
		this.clientLoader = null;
	}

	/**
	 * Create or return a Socket.IO namespace connection.
	 *
	 * @param {string} name
	 * @returns {Promise<object>}
	 */
	async namespace(name) {
		if (!name) {
			throw new Error("A Socket.IO namespace is required.");
		}

		if (!this.namespaces[name]) {
			const io = await this.loadClient();
			const socket = io(name);
			this.namespaces[name] = socket;
			socket.onAny((eventName, ...args) => {
				this.fire("message", name, eventName, ...args);
				this.fire(`message::${name}`, name, eventName, ...args);
			});
		}

		return this.namespaces[name];
	}

	/**
	 * Listen for events from a namespace.
	 *
	 * @param {string} namespaceName
	 * @param {string} eventName
	 * @param {Function} listener
	 * @returns {Promise<Function>}
	 */
	async on(namespaceName, eventName, listener) {
		const socket = await this.namespace(namespaceName);
		socket.on(eventName, listener);
		return listener;
	}

	/**
	 * Remove an event listener from a namespace.
	 *
	 * @param {string} namespaceName
	 * @param {string} eventName
	 * @param {Function} listener
	 * @returns {Promise<void>}
	 */
	async off(namespaceName, eventName, listener) {
		const socket = await this.namespace(namespaceName);
		socket.off(eventName, listener);
	}

	/**
	 * Send a message without waiting for a response.
	 *
	 * @param {string} namespaceName
	 * @param {string} message
	 * @param {object} data
	 * @returns {Promise<void>}
	 */
	async send(namespaceName, message, data = {}) {
		const socket = await this.namespace(namespaceName);
		socket.emit(message, data);
	}

	/**
	 * Send a message and wait for the Socket.IO acknowledgement.
	 *
	 * @param {string} namespaceName
	 * @param {string} message
	 * @param {object} data
	 * @returns {Promise<unknown>}
	 */
	async get(namespaceName, message, data = {}) {
		const socket = await this.namespace(namespaceName);

		return new Promise((resolve) => {
			socket.emit(message, data, resolve);
		});
	}

	async loadClient() {
		if (typeof window === "undefined") {
			throw new Error("Socket.IO client is only available in the browser.");
		}

		if (window.io) {
			return window.io;
		}

		if (!this.clientLoader) {
			this.clientLoader = new Promise((resolve, reject) => {
				const script = document.createElement("script");
				script.src = SOCKET_IO_CLIENT_SCRIPT;
				script.async = true;
				script.onload = () => resolve(window.io);
				script.onerror = () => reject(new Error(`Failed to load ${SOCKET_IO_CLIENT_SCRIPT}.`));
				document.head.appendChild(script);
			});
		}

		return this.clientLoader;
	}
}

new StreamService();
