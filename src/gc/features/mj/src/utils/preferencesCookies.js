const COOKIE_NAME = "mj_preferences";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function readMjPreferencesCookie() {
	if (typeof document === "undefined" || !document.cookie) {
		return null;
	}

	var cookieValue = document.cookie
		.split("; ")
		.find(function(entry) {
			return entry.indexOf(`${COOKIE_NAME}=`) === 0;
		});

	if (!cookieValue) {
		return null;
	}

	try {
		return JSON.parse(decodeURIComponent(cookieValue.slice(COOKIE_NAME.length + 1)));
	} catch (err) {
		return null;
	}
}

export function writeMjPreferencesCookie(preferences) {
	if (typeof document === "undefined") {
		return;
	}

	var serialized = encodeURIComponent(JSON.stringify(preferences || {}));

	document.cookie = [
		`${COOKIE_NAME}=${serialized}`,
		`Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
		"Path=/",
		"SameSite=Lax",
	].join("; ");
}
