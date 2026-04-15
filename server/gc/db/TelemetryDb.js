import { MongoClient } from "mongodb";

/**
 * Persist MJ gameplay telemetry records in a Mongo collection.
 */
export default class TelemetryDb {
	/**
	 * @param {FeedbackDbOptions} options - Supply the Mongo connection settings used by this store.
	 */
	constructor({uri, dbName, collectionName}) {
		/** @type {string} */
		this.uri = uri;

		/** @type {string} */
		this.dbName = dbName;

		/** @type {string} */
		this.collectionName = collectionName;

		/** @type {MongoClient | null} */
		this.client = null;

		/** @type {import("mongodb").Collection<MjStoredTelemetryRecord> | null} */
		this.collection = null;
	}

	/**
	 * Connect the shared Mongo client and prepare the collection handle.
	 *
	 * @returns {Promise<void>}
	 */
	async open() {
		if (this.collection) {
			return;
		}

		if (!this.uri || !this.dbName || !this.collectionName) {
			throw new Error("TelemetryDb requires uri, dbName, and collectionName");
		}

		this.client = new MongoClient(this.uri);
		await this.client.connect();
		this.collection = this.client
			.db(this.dbName)
			.collection(this.collectionName);
	}

	/**
	 * Store a telemetry record and return the inserted id.
	 *
	 * @param {MjStoredTelemetryRecord} telemetry - Carry the server-normalized telemetry record to persist.
	 * @returns {Promise<import('mongodb').ObjectId>}
	 */
	async insertTelemetry(telemetry) {
		await this.open();
		let result = await this.collection.insertOne(telemetry);
		return result.insertedId;
	}
}
