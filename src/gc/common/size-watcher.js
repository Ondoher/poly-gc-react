import { Service } from '@polylith/core';
import { debounce } from './utils.js';

/**
 * Use this service to track the current browser viewport size and notify
 * listeners when it changes.
 */
export default class SizeWatcher extends Service {
	constructor() {
		super('size-watcher');
		this.implement(['ready', 'check', 'getSize']);

		/**
		 * Store the current viewport dimensions.
		 *
		 * @type {{width: number, height: number}}
		 */
		this.size = {
			width: 0,
			height: 0,
		};

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
		this.updateSize();
		this.fire('changed', this.getSize());
	}

	/**
	 * Call this method to get the current viewport size.
	 *
	 * @returns {{width: number, height: number}} The current viewport dimensions.
	 */
	getSize() {
		return {
			width: this.size.width,
			height: this.size.height,
		};
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
}

new SizeWatcher();
