import { getPipelineStream } from "./stream.js";

const ASSET_PIPELINE_NAMESPACE = "/asset-pipeline";

/**
 * Owns live progress events for long-running generated asset work.
 */
export class AssetPipelineStream {
	constructor(stream = getPipelineStream()) {
		this.stream = stream;
		this.namespaceName = ASSET_PIPELINE_NAMESPACE;
		this.connections = {};
		this.latestProgressByTileset = {};
		this.queueStateByTileset = {};

		this.stream.on("ioInit", this.streamReady.bind(this));
		this.stream.on("namespaceConnect", this.namespaceConnect.bind(this));
		this.stream.on("namespaceDisconnect", this.namespaceDisconnect.bind(this));
	}

	/**
	 * Create the Socket.IO namespace after the root stream is initialized.
	 */
	streamReady() {
		this.namespace = this.stream.namespace(this.namespaceName);
	}

	/**
	 * Track one connected browser on the asset-pipeline namespace.
	 *
	 * @param {string} name
	 * @param {string} clientId
	 * @param {import("socket.io").Socket} socket
	 */
	namespaceConnect(name, clientId, socket) {
		if (name !== this.namespaceName) {
			return;
		}

		this.connections[clientId] = { socket };
		socket.on("watchAssetPipeline", this.watchAssetPipeline.bind(this, clientId));
	}

	/**
	 * Remove a disconnected browser from local tracking.
	 *
	 * @param {string} name
	 * @param {string} clientId
	 */
	namespaceDisconnect(name, clientId) {
		if (name !== this.namespaceName) {
			return;
		}

		delete this.connections[clientId];
	}

	/**
	 * Join a tileset-specific progress room.
	 *
	 * @param {string} clientId
	 * @param {{tilesetId?: string}} data
	 * @param {Function} [callback]
	 */
	watchAssetPipeline(clientId, data = {}, callback) {
		const connection = this.connections[clientId];
		const tilesetId = sanitizeTilesetId(data.tilesetId);

		if (!connection || !tilesetId) {
			if (callback) {
				callback({ ok: false, message: "A tilesetId is required." });
			}
			return;
		}

		connection.socket.join(roomForTileset(tilesetId));
		const snapshot = this.latestProgressByTileset[tilesetId] || null;

		if (callback) {
			callback({ ok: true, tilesetId, snapshot });
		}

		if (snapshot) {
			connection.socket.emit("assetGenerationSnapshot", snapshot);
		}
	}

	/**
	 * Broadcast one generated asset progress event.
	 *
	 * @param {string} tilesetId
	 * @param {string} eventName
	 * @param {object} payload
	 */
	emitProgress(tilesetId, eventName, payload = {}) {
		const safeTilesetId = sanitizeTilesetId(tilesetId);
		if (!safeTilesetId) {
			return;
		}

		const event = {
			tilesetId: safeTilesetId,
			eventName,
			...payload,
		};

		this.updateQueueState(safeTilesetId, event);
		this.latestProgressByTileset[safeTilesetId] = event;
		if (this.namespace) {
			this.namespace.to(roomForTileset(safeTilesetId)).emit(eventName, event);
		}
	}

	/**
	 * Return the live queue state for a tileset.
	 *
	 * @param {string} tilesetId
	 * @returns {{activeFaceKey: string, queuedFaceKeys: string[], currentStep: string, stageLabel: string}}
	 */
	getQueueState(tilesetId) {
		const safeTilesetId = sanitizeTilesetId(tilesetId);
		const state = this.queueStateByTileset[safeTilesetId] || {};
		return {
			activeFaceKey: state.activeFaceKey || "",
			queuedFaceKeys: Array.from(state.queuedFaceKeys || []),
			currentStep: state.currentStep || "",
			stageLabel: state.stageLabel || "",
			stageProgress: cleanStageProgress(state.stageProgress),
		};
	}

	/**
	 * Clear the runtime-only queue snapshot for a tileset.
	 *
	 * @param {string} tilesetId
	 * @returns {void}
	 */
	clearQueueState(tilesetId) {
		const safeTilesetId = sanitizeTilesetId(tilesetId);
		if (!safeTilesetId) {
			return;
		}

		this.queueStateByTileset[safeTilesetId] = {
			activeFaceKey: "",
			queuedFaceKeys: new Set(),
			currentStep: "",
			stageLabel: "",
			stageProgress: null,
		};
	}

	/**
	 * Update the runtime-only queue snapshot from one progress event.
	 *
	 * @param {string} tilesetId
	 * @param {object} event
	 * @returns {void}
	 */
	updateQueueState(tilesetId, event) {
		if (event.eventName === "assetGenerationComplete" || event.eventName === "assetGenerationFailed") {
			this.queueStateByTileset[tilesetId] = {
				activeFaceKey: "",
				queuedFaceKeys: new Set(),
				currentStep: "",
				stageLabel: "",
				stageProgress: null,
			};
			return;
		}

		if (event.eventName === "assetGenerationStarted") {
			this.queueStateByTileset[tilesetId] = {
				activeFaceKey: "",
				queuedFaceKeys: new Set(event.plannedFaceKeys || []),
				currentStep: "",
				stageLabel: "",
				stageProgress: null,
			};
			return;
		}

		const state = this.queueStateByTileset[tilesetId] || {
			activeFaceKey: "",
			queuedFaceKeys: new Set(),
			currentStep: "",
			stageLabel: "",
			stageProgress: null,
		};
		const faceKey = event.faceKey || "";

		if (!faceKey) {
			this.queueStateByTileset[tilesetId] = state;
			return;
		}

		if (event.eventName === "assetGenerationFaceReady" || event.status === "ready" || event.status === "skipped") {
			state.queuedFaceKeys.delete(faceKey);
			if (state.activeFaceKey === faceKey) {
				state.activeFaceKey = "";
				state.currentStep = "";
				state.stageLabel = "";
				state.stageProgress = null;
			}
		} else if (event.status === "building") {
			state.queuedFaceKeys.delete(faceKey);
			state.activeFaceKey = faceKey;
			state.currentStep = event.stage || "";
			state.stageLabel = event.stageLabel || event.stage || "";
			state.stageProgress = cleanStageProgress(event.stageProgress);
		} else if (event.status === "queued") {
			if (state.activeFaceKey === faceKey) {
				state.activeFaceKey = "";
				state.currentStep = "";
				state.stageLabel = "";
				state.stageProgress = null;
			}
			state.queuedFaceKeys.add(faceKey);
		} else if (event.status === "failed") {
			state.queuedFaceKeys.delete(faceKey);
			if (state.activeFaceKey === faceKey) {
				state.activeFaceKey = "";
				state.currentStep = "";
				state.stageLabel = "";
				state.stageProgress = null;
			}
		}

		this.queueStateByTileset[tilesetId] = state;
	}
}

function roomForTileset(tilesetId) {
	return `tileset:${tilesetId}`;
}

function sanitizeTilesetId(tilesetId) {
	return typeof tilesetId === "string" && /^[a-zA-Z0-9_-]+$/.test(tilesetId)
		? tilesetId
		: "";
}

function cleanStageProgress(progress) {
	if (!progress || typeof progress !== "object") {
		return null;
	}

	const current = Number(progress.current);
	const total = Number(progress.total);
	const percent = Number(progress.percent);
	return {
		stage: String(progress.stage || ""),
		phase: String(progress.phase || ""),
		current: Number.isFinite(current) ? current : 0,
		total: Number.isFinite(total) ? total : 0,
		percent: Number.isFinite(percent)
			? Math.max(0, Math.min(100, Math.round(percent)))
			: Number.isFinite(current) && Number.isFinite(total) && total > 0
				? Math.round((current / total) * 100)
				: 0,
		message: String(progress.message || ""),
	};
}

const assetPipelineStream = new AssetPipelineStream();

/**
 * Return the shared asset pipeline live-progress stream.
 *
 * @returns {AssetPipelineStream}
 */
export function getAssetPipelineStream() {
	return assetPipelineStream;
}
