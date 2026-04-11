function getSearchParams() {
	if (typeof window === 'undefined') {
		return new URLSearchParams();
	}

	return new URLSearchParams(window.location.search || '');
}

function normalizeGameTarget(value) {
	if (!value) {
		return null;
	}

	let normalized = String(value).trim().toLowerCase();

	if (normalized === 'mj') {
		return 'mahjongg';
	}

	return normalized;
}

export function getStartupTarget() {
	let params = getSearchParams();
	let showDirectory = params.get('directory');

	if (showDirectory === '1' || showDirectory === 'true') {
		return 'directory';
	}

	let explicitTarget = normalizeGameTarget(
		params.get('game') || params.get('feature')
	);

	if (explicitTarget) {
		return explicitTarget;
	}

	return 'mahjongg';
}

export function shouldLaunchDirectory() {
	return getStartupTarget() === 'directory';
}

export function shouldDirectLaunch(gameName) {
	return getStartupTarget() === normalizeGameTarget(gameName);
}
