/**
 * Owns Socket.IO setup and namespace creation for pipeline live channels.
 */
export class PipelineStream {
	constructor() {
		this.clients = {};
		this.namespaces = {};
		this.listeners = {};
	}

	/**
	 * Attach the Polylith-provided Socket.IO server.
	 *
	 * @param {import("socket.io").Server} io
	 */
	setup(io) {
		this.io = io;
		this.io.on("connection", this.socketConnect.bind(this));
		this.emit("ioInit", io);
	}

	/**
	 * Return an existing namespace, or create it on first access.
	 *
	 * @param {string} name
	 * @returns {import("socket.io").Namespace}
	 */
	namespace(name) {
		if (!this.io) {
			throw new Error("Pipeline stream has not been initialized.");
		}

		this.namespaces[name] = this.namespaces[name] || this.makeNamespace(name);
		return this.namespaces[name];
	}

	/**
	 * Subscribe to a stream lifecycle event.
	 *
	 * @param {string} eventName
	 * @param {Function} listener
	 */
	on(eventName, listener) {
		this.listeners[eventName] = this.listeners[eventName] || [];
		this.listeners[eventName].push(listener);
	}

	/**
	 * Remove a stream lifecycle listener.
	 *
	 * @param {string} eventName
	 * @param {Function} listener
	 */
	off(eventName, listener) {
		this.listeners[eventName] = (this.listeners[eventName] || []).filter((item) => {
			return item !== listener;
		});
	}

	makeNamespace(name) {
		const namespace = this.io.of(name);
		namespace.on("connection", this.namespaceConnect.bind(this, name));
		return namespace;
	}

	namespaceConnect(name, socket) {
		const clientId = this.getClientId(socket);
		const client = this.clients[clientId] || {
			clientId,
			sockets: [],
		};

		if (!client.sockets.includes(socket.id)) {
			client.sockets.push(socket.id);
		}

		this.clients[clientId] = client;
		socket.on("disconnect", this.namespaceDisconnect.bind(this, name, clientId, socket));
		this.emit("namespaceConnect", name, clientId, socket);
	}

	namespaceDisconnect(name, clientId, socket) {
		this.removeSocketFromClient(clientId, socket.id);
		this.emit("namespaceDisconnect", name, clientId);
	}

	socketConnect(socket) {
		const clientId = this.getClientId(socket);
		this.clients[clientId] = {
			clientId,
			sockets: [socket.id],
		};

		socket.on("disconnect", this.socketDisconnect.bind(this, clientId, socket.id));
		this.emit("connect", clientId, socket.id);
	}

	socketDisconnect(clientId, socketId, reason) {
		this.removeSocketFromClient(clientId, socketId);
		this.emit("disconnect", clientId, reason);
	}

	getClientId(socket) {
		return socket.conn.id;
	}

	removeSocketFromClient(clientId, socketId) {
		const client = this.clients[clientId];

		if (!client) {
			return;
		}

		client.sockets = client.sockets.filter((item) => {
			return item !== socketId;
		});

		if (client.sockets.length === 0) {
			delete this.clients[clientId];
		}
	}

	emit(eventName, ...args) {
		for (const listener of this.listeners[eventName] || []) {
			listener(...args);
		}
	}
}

const pipelineStream = new PipelineStream();

/**
 * Return the shared pipeline stream service.
 *
 * @returns {PipelineStream}
 */
export function getPipelineStream() {
	return pipelineStream;
}

/**
 * Initialize the pipeline stream from the Polylith server app.
 *
 * @param {object} app
 * @returns {Promise<PipelineStream>}
 */
export async function initializePipelineStream(app) {
	if (!app || typeof app.getSocketIo !== "function") {
		return pipelineStream;
	}

	const socketIo = await app.getSocketIo();
	if (socketIo && !pipelineStream.io) {
		pipelineStream.setup(socketIo);
	}

	return pipelineStream;
}
