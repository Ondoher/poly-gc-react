export default class PipelinePresentationModel {
	static assetUrl(filename) {
		return `api/pipeline/asset?path=${encodeURIComponent(filename)}`;
	}

	static referenceImageUrl(faceKey) {
		return `api/pipeline/reference/${encodeURIComponent(`${faceKey}.png`)}`;
	}

	static normalizeHexColor(color, { uppercase = false } = {}) {
		const normalized = String(color || "").trim().replace(/^#/, "");
		const hex = normalized.length === 3
			? normalized.split("").map((digit) => digit + digit).join("")
			: normalized;

		if (!/^[0-9a-f]{6}$/i.test(hex)) {
			return "";
		}

		return uppercase ? `#${hex.toUpperCase()}` : `#${hex.toLowerCase()}`;
	}

	static hexToRgba(color, alpha, fallback = "0, 0, 0") {
		const normalized = PipelinePresentationModel.normalizeHexColor(color);

		if (!normalized) {
			return `rgba(${fallback}, ${alpha})`;
		}

		const value = normalized.slice(1);
		const red = Number.parseInt(value.slice(0, 2), 16);
		const green = Number.parseInt(value.slice(2, 4), 16);
		const blue = Number.parseInt(value.slice(4, 6), 16);

		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	static titleCase(value) {
		return String(value || "")
			.replace(/[-_]+/g, " ")
			.replace(/\b\w/g, (character) => character.toUpperCase());
	}
}
