import layouts from './layouts.json';

const LOCALHOST_ONLY_LAYOUT_IDS = new Set([
	"easy",
	"test"
]);

function isLocalhost() {
	if (typeof window === 'undefined' || !window.location) {
		return false;
	}

	let hostname = (window.location.hostname || '').toLowerCase();

	return (
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname === '::1'
	);
}

function filterLayoutsByHost(allLayouts) {
	if (LOCALHOST_ONLY_LAYOUT_IDS.size === 0 || isLocalhost()) {
		return allLayouts;
	}

	return Object.fromEntries(
		Object.entries(allLayouts).filter(function([layoutId]) {
			return !LOCALHOST_ONLY_LAYOUT_IDS.has(layoutId);
		})
	);
}

export { LOCALHOST_ONLY_LAYOUT_IDS };

export default filterLayoutsByHost(layouts);
