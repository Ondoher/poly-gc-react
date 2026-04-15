import { Service } from "@polylith/core";
import FeedbackDb from "../db/FeedbackDb.js";
import TelemetryDb from "../db/TelemetryDb.js";

const ALLOWED_SKILL_LEVELS = new Set([
	"beginner",
	"intermediate",
	"experienced",
]);

const ALLOWED_DIFFICULTY_FEELINGS = new Set([
	"too-easy",
	"about-right",
	"too-hard",
]);

const ALLOWED_FAIRNESS_FEELINGS = new Set([
	"fair",
	"frustrating",
	"very-frustrating",
]);

export default class FeedbackService extends Service {
	constructor(registry) {
		super("feedback", registry);
		this.implement(["ready", "routes"]);
		this.feedbackDb = null;
		this.telemetryDb = null;
	}

	ready() {
		this.routerService = this.registry.subscribe("routers");
		this.config = this.registry.subscribe("config");
		this.routerService.add(this.serviceName);
	}

	routes(express, router, app) {
		router.post("/api/feedback", this.submitFeedback.bind(this));
		router.post("/api/telemetry", this.submitTelemetry.bind(this));
	}

	getFeedbackDb() {
		if (!this.feedbackDb) {
			this.feedbackDb = new FeedbackDb({
				uri: this.config.get("mongo.uri", "mongodb://127.0.0.1:27017"),
				dbName: this.config.get("mongo.db", "poly_gc_dev"),
				collectionName: this.config.get(
					"mongo.collections.feedback",
					"feedback"
				),
			});
		}

		return this.feedbackDb;
	}

	getTelemetryDb() {
		if (!this.telemetryDb) {
			this.telemetryDb = new TelemetryDb({
				uri: this.config.get("mongo.uri", "mongodb://127.0.0.1:27017"),
				dbName: this.config.get("mongo.db", "poly_gc_dev"),
				collectionName: this.config.get(
					"mongo.collections.telemetry",
					"telemetry"
				),
			});
		}

		return this.telemetryDb;
	}

	coerceEnum(value, allowedValues) {
		if (typeof value !== "string") {
			return "";
		}

		return allowedValues.has(value) ? value : "";
	}

	/**
	 * Return one sanitized replayable tile sequence.
	 *
	 * @param {unknown} value - Carry the raw tile sequence candidate from the request payload.
	 * @returns {[number, number][]} Return the sanitized tile sequence.
	 */
	coerceTileSequence(value) {
		if (!Array.isArray(value)) {
			return [];
		}

		return value.reduce(function(result, pair) {
			if (!Array.isArray(pair) || pair.length !== 2) {
				return result;
			}

			let tile1 = Number(pair[0]);
			let tile2 = Number(pair[1]);

			if (!Number.isFinite(tile1) || !Number.isFinite(tile2)) {
				return result;
			}

			result.push([tile1, tile2]);
			return result;
		}, []);
	}

	/**
	 * Return one sanitized telemetry payload.
	 *
	 * @param {unknown} body - Carry the submitted telemetry payload candidate.
	 * @returns {MjStoredTelemetryRecord | null} Return the sanitized telemetry record or null when the payload is invalid.
	 */
	buildTelemetryRecord(body) {
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return null;
		}

		let boardNbr = Number(body.boardNbr);
		let elapsedTimeMs = Number(body.elapsedTimeMs);

		return {
			submittedAt: new Date().toISOString(),
			boardNbr: Number.isFinite(boardNbr) ? boardNbr : null,
			difficulty: typeof body.difficulty === "string" ? body.difficulty : "",
			layout: typeof body.layout === "string" ? body.layout : "",
			elapsedTimeMs: Number.isFinite(elapsedTimeMs)
				? Math.max(0, Math.floor(elapsedTimeMs))
				: 0,
			result:
				body.result === "won" ||
				body.result === "lost" ||
				body.result === "abandoned"
					? body.result
					: "",
			tileSequence: this.coerceTileSequence(body.tileSequence),
		};
	}

	/**
	 * Return one sanitized optional gameplay context snapshot.
	 *
	 * @param {MjFeedbackPayload} body - Carry the validated client feedback payload.
	 * @param {number | null} fallbackBoardNbr - Identify the already-sanitized top-level board number.
	 * @returns {MjStoredFeedbackContext | null} Return the sanitized gameplay context or null when context is unavailable.
	 */
	buildFeedbackContext(body, fallbackBoardNbr) {
		let context = body.context;

		if (!context || typeof context !== "object" || Array.isArray(context)) {
			return {
				boardNbr: fallbackBoardNbr,
				difficulty: "",
				layout: "",
				elapsedTimeMs: 0,
				result: "",
				tileSequence: [],
			};
		}

		let boardNbr = Number(context.boardNbr);
		let elapsedTimeMs = Number(context.elapsedTimeMs);

		return {
			boardNbr: Number.isFinite(boardNbr) ? boardNbr : fallbackBoardNbr,
			difficulty: typeof context.difficulty === "string" ? context.difficulty : "",
			layout: typeof context.layout === "string" ? context.layout : "",
			elapsedTimeMs: Number.isFinite(elapsedTimeMs)
				? Math.max(0, Math.floor(elapsedTimeMs))
				: 0,
			result:
				context.result === "won" ||
				context.result === "lost" ||
				context.result === "abandoned"
					? context.result
					: "",
			tileSequence: this.coerceTileSequence(context.tileSequence),
		};
	}

	/**
	 * Build one stored feedback record from the request payload.
	 *
	 * @param {MjFeedbackPayload} body - Carry the validated client feedback payload.
	 */
	buildFeedbackRecord(body) {
		let boardNbr = Number(body.boardNbr);
		let includeContext = body.includeContext === true;
		let comment = typeof body.comment === "string" ? body.comment.trim() : "";
		let difficultyLabel =
			typeof body.difficultyLabel === "string" ? body.difficultyLabel : "";
		let layoutTitle =
			typeof body.layoutTitle === "string" ? body.layoutTitle : "";

		return {
			submittedAt: new Date().toISOString(),
			boardNbr: Number.isFinite(boardNbr) ? boardNbr : null,
			difficultyLabel,
			layoutTitle,
			includeContext,
			skillLevel: this.coerceEnum(body.skillLevel, ALLOWED_SKILL_LEVELS),
			difficultyFeeling: this.coerceEnum(
				body.difficultyFeeling,
				ALLOWED_DIFFICULTY_FEELINGS
			),
			fairnessFeeling: this.coerceEnum(
				body.fairnessFeeling,
				ALLOWED_FAIRNESS_FEELINGS
			),
			comment,
			context: includeContext
				? this.buildFeedbackContext(
					body,
					Number.isFinite(boardNbr) ? boardNbr : null
				)
				: null,
		};
	}

	/**
	 * Save one feedback submission from the MJ frontend.
	 *
	 * @param {import("express").Request} req - Carry the submitted feedback payload in the request body.
	 * @param {import("express").Response} res - Return success or failure details to the client.
	 */
	async submitFeedback(req, res) {
		let body = req.body;

		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return res.status(400).json({
				success: false,
				reason: "feedback.invalid_body",
			});
		}

		let feedback = this.buildFeedbackRecord(body);

		try {
			let insertedId = await this.getFeedbackDb().insertFeedback(feedback);
			return res.json({
				success: true,
				id: String(insertedId),
			});
		} catch (error) {
			console.error("Unable to save feedback");
			console.error(error);
			return res.status(500).json({
				success: false,
				reason: "feedback.save_failed",
			});
		}
	}

	/**
	 * Save one gameplay telemetry submission from the MJ frontend.
	 *
	 * @param {import("express").Request} req - Carry the submitted telemetry payload in the request body.
	 * @param {import("express").Response} res - Return success or failure details to the client.
	 */
	async submitTelemetry(req, res) {
		let telemetry = this.buildTelemetryRecord(req.body);

		if (!telemetry) {
			return res.status(400).json({
				success: false,
				reason: "telemetry.invalid_body",
			});
		}

		try {
			let insertedId = await this.getTelemetryDb().insertTelemetry(telemetry);
			return res.json({
				success: true,
				id: String(insertedId),
			});
		} catch (error) {
			console.error("Unable to save telemetry");
			console.error(error);
			return res.status(500).json({
				success: false,
				reason: "telemetry.save_failed",
			});
		}
	}
}

new FeedbackService();
