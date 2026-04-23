import { Service } from '@polylith/core';
import { debounce } from './utils.js';

const PORTRAIT_HEIGHT_RATIO = 1.05;

/**
 * Use this service to track the current browser viewport size and notify
 * listeners when it changes.
 */
export default class SizeWatcher extends Service {
	constructor() {
		super('size-watcher');
		this.implement(['ready', 'check', 'getSize', 'getMode', 'matchesMode']);

		/**
		 * Store the current viewport dimensions.
		 *
		 * @type {SizeWatcherViewportSize}
		 */
		this.size = {
			width: 0,
			height: 0,
		};

		/**
		 * Store the current derived viewport mode.
		 *
		 * Raw size changes can be frequent during resizing. Mode changes are
		 * coarser semantic transitions that layout components can react to
		 * without re-deriving the same breakpoints.
		 *
		 * @type {SizeWatcherMode}
		 */
		this.mode = this.calculateMode(this.size);

		this.onWindowResize = this.onWindowResize.bind(this);
		this.fireChangedDebounced = debounce(() => {
			this.check();
		}, 100, 300);
	}

	ready() {
		if (typeof window === 'undefined') {
			return;
		}

		window.addEventListener('resize', this.onWindowResize);
		this.check();
	}

	/**
	 * Call this method to immediately measure the viewport and fire the
	 * current size to listeners.
	 */
	check() {
		var previousMode = this.getMode();

		this.updateSize();
		this.mode = this.calculateMode(this.size);
		this.fire('changed', this.getSize());

		if (!this.areModesEqual(previousMode, this.mode)) {
			this.fire('mode-changed', this.getMode());
		}
	}

	/**
	 * Call this method to get the current viewport size.
	 *
	 * @returns {SizeWatcherViewportSize} The current viewport dimensions.
	 */
	getSize() {
		return {
			width: this.size.width,
			height: this.size.height,
		};
	}

	/**
	 * Call this method to get the current semantic viewport mode.
	 *
	 * @returns {SizeWatcherMode} The current derived viewport mode.
	 */
	getMode() {
		return {
			orientation: this.mode.orientation,
			isPortrait: this.mode.isPortrait,
			isLandscape: this.mode.isLandscape,
			isNarrowPortrait: this.mode.isNarrowPortrait,
			sizeClass: this.mode.sizeClass,
		};
	}

	/**
	 * Query one or more semantic viewport mode properties.
	 *
	 * @param {SizeWatcherModeQuery} query - Specify a mode flag name or expected mode shape.
	 * @returns {boolean}
	 */
	matchesMode(query) {
		var mode = this.getMode();

		if (typeof query === "string") {
			return mode[query] === true;
		}

		if (!query || typeof query !== "object") {
			return false;
		}

		return Object.keys(query).every(function(key) {
			return mode[key] === query[key];
		});
	}

	onWindowResize() {
		this.fireChangedDebounced();
	}

	updateSize() {
		var docEl = document.documentElement;
		var width = window.innerWidth || docEl?.clientWidth || 0;
		var height = window.innerHeight || docEl?.clientHeight || 0;

		this.size = {
			width,
			height,
		};
	}

	/**
	 * Derive a semantic mode from a viewport size.
	 *
	 * @param {SizeWatcherViewportSize} size - Specify the viewport size.
	 * @returns {SizeWatcherMode}
	 */
	calculateMode(size) {
		var width = size?.width || 0;
		var height = size?.height || 0;
		var isPortrait = height > width * PORTRAIT_HEIGHT_RATIO;

		return {
			orientation: isPortrait ? "portrait" : "landscape",
			isPortrait,
			isLandscape: !isPortrait,
			isNarrowPortrait: isPortrait && width <= 900,
			sizeClass: this.getSizeClass(width),
		};
	}

	/**
	 * Derive the coarse viewport width class.
	 *
	 * @param {number} width - Specify the viewport width.
	 * @returns {SizeWatcherSizeClass}
	 */
	getSizeClass(width) {
		if (width <= 640) {
			return "compact";
		}

		if (width <= 1024) {
			return "regular";
		}

		return "wide";
	}

	/**
	 * Compare two semantic viewport modes.
	 *
	 * @param {SizeWatcherMode} left - Specify one mode.
	 * @param {SizeWatcherMode} right - Specify another mode.
	 * @returns {boolean}
	 */
	areModesEqual(left, right) {
		return (
			left.orientation === right.orientation &&
			left.isPortrait === right.isPortrait &&
			left.isLandscape === right.isLandscape &&
			left.isNarrowPortrait === right.isNarrowPortrait &&
			left.sizeClass === right.sizeClass
		);
	}
}

new SizeWatcher();
