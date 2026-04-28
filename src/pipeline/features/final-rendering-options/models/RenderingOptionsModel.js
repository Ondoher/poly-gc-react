const DEFAULT_PART_IDS = ["label"];
const FLOWER_SEASON_PART_IDS = ["label", "glyph"];

export default class RenderingOptionsModel {
	constructor(renderingOptions = null) {
		this.renderingOptions = renderingOptions || {};
	}

	faces() {
		return RenderingOptionsModel.faces(this.renderingOptions);
	}

	initialOptions() {
		return RenderingOptionsModel.initialOptions(this.renderingOptions);
	}

	groupFacesByFamily(faces = this.faces()) {
		return faces.reduce((groups, face) => {
			const family = face.family || RenderingOptionsModel.faceFamily(face.faceKey);

			return {
				...groups,
				[family]: [
					...(groups[family] || []),
					face,
				],
			};
		}, {});
	}

	static faces(renderingOptions) {
		return Object.values(renderingOptions?.faces || {})
			.sort((left, right) => left.faceKey.localeCompare(right.faceKey));
	}

	static initialOptions(renderingOptions) {
		return {
			suits: Object.fromEntries(Object.entries(renderingOptions?.suitOptions || {})
				.map(([family, options]) => [family, RenderingOptionsModel.normalizeOptionGroup(options, { suitId: family })])),
			faces: Object.fromEntries(Object.entries(renderingOptions?.faceOptions || {})
				.map(([faceKey, options]) => [faceKey, RenderingOptionsModel.normalizeFaceOptionGroup(options, { faceKey, suitId: options?.suitId || RenderingOptionsModel.faceFamily(faceKey) })])),
		};
	}

	static normalizeOptionGroup(group, identity) {
		const partIds = RenderingOptionsModel.optionPartIdsForFamily(identity.suitId);

		return {
			...identity,
			...(group || {}),
			parts: Object.fromEntries(partIds.map((partId) => [
				partId,
				RenderingOptionsModel.partOptionForMode(partId, RenderingOptionsModel.renderModeForPart(group?.parts?.[partId])),
			])),
			transform: RenderingOptionsModel.normalizeTransformOptions(group?.transform),
			artwork: RenderingOptionsModel.normalizeArtworkOptions(group?.artwork),
		};
	}

	static normalizeFaceOptionGroup(group, identity) {
		const partIds = new Set(RenderingOptionsModel.optionPartIdsForFamily(identity.suitId));

		return {
			...identity,
			...(group || {}),
			parts: Object.fromEntries(Object.entries(group?.parts || {})
				.filter(([partId]) => partIds.has(partId))
				.map(([partId, part]) => [partId, RenderingOptionsModel.partOptionForMode(partId, RenderingOptionsModel.renderModeForPart(part))])),
			transform: RenderingOptionsModel.normalizeTransformOptions(group?.transform),
			artwork: RenderingOptionsModel.normalizeArtworkOptions(group?.artwork),
		};
	}

	static updateOptionGroupPart(group, identity, partId, renderMode) {
		return {
			...(group || {}),
			...identity,
			parts: {
				...(group?.parts || {}),
				[partId]: RenderingOptionsModel.partOptionForMode(partId, renderMode),
			},
		};
	}

	static removeOptionGroupPart(group, partId) {
		if (!group) {
			return null;
		}

		const parts = { ...(group.parts || {}) };
		delete parts[partId];

		return {
			...group,
			parts,
		};
	}

	static updateFaceArtworkReflectX(group, identity, reflectX) {
		const transform = RenderingOptionsModel.normalizeTransformOptions(group?.transform);
		transform.reflectX = Boolean(reflectX);

		return {
			...(group || {}),
			...identity,
			transform,
		};
	}

	static removeFaceArtworkReflectX(group) {
		if (!group) {
			return null;
		}

		const transform = RenderingOptionsModel.normalizeTransformOptions(group.transform);
		delete transform.reflectX;

		return {
			...group,
			transform,
		};
	}

	static updateFaceArtworkPreserveColors(group, identity, preserveColors) {
		const artwork = RenderingOptionsModel.normalizeArtworkOptions(group?.artwork);
		artwork.preserveColors = Boolean(preserveColors);

		return {
			...(group || {}),
			...identity,
			artwork,
		};
	}

	static hasFaceOverrides(group) {
		return Object.keys(group?.parts || {}).length > 0
			|| Object.keys(RenderingOptionsModel.normalizeTransformOptions(group?.transform)).length > 0
			|| Object.keys(RenderingOptionsModel.normalizeArtworkOptions(group?.artwork)).length > 0;
	}

	static normalizeTransformOptions(transform) {
		if (!transform || typeof transform !== "object") {
			return {};
		}

		return {
			...("reflectX" in transform ? { reflectX: Boolean(transform.reflectX) } : {}),
		};
	}

	static normalizeArtworkOptions(artwork) {
		if (!artwork || typeof artwork !== "object") {
			return {};
		}

		return {
			...("preserveColors" in artwork ? { preserveColors: Boolean(artwork.preserveColors) } : {}),
		};
	}

	static partOptionForMode(partId, renderMode) {
		const mode = renderMode === "omit" || renderMode === "generated" ? renderMode : "source-preferred";

		return {
			partId,
			contentKind: partId === "glyph" ? "glyph" : "label",
			outputPresent: mode !== "omit",
			source: mode === "omit" ? "omit" : mode === "generated" ? "generated" : "source-preferred",
			renderMode: mode,
			reviewStatus: "reviewed",
		};
	}

	static renderModeForPart(part) {
		if (!part) {
			return "source-preferred";
		}

		if (part.renderMode) {
			return part.renderMode;
		}

		if (part.outputPresent === false) {
			return "omit";
		}

		if (part.source === "generated") {
			return "generated";
		}

		return "source-preferred";
	}

	static optionPartIdsForFamily(family) {
		return family === "flower" || family === "season"
			? FLOWER_SEASON_PART_IDS
			: DEFAULT_PART_IDS;
	}

	static faceFamily(faceKey) {
		const prefix = String(faceKey || "").split("-")[0];
		return {
			b: "bamboo",
			c: "character",
			d: "dot",
			dragon: "dragon",
			flower: "flower",
			season: "season",
			wind: "wind",
		}[prefix] || prefix || "other";
	}

	static partLabel(partId) {
		return partId === "glyph" ? "Glyph" : "Character";
	}
}
