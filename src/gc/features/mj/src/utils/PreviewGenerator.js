import React from 'react';
import { createRoot } from 'react-dom/client';
import { toBlob, toPng } from 'html-to-image';

import PreviewWrapper from '../components/PreviewWrapper.jsx';
import layouts from '../data/layouts.js';
import { TILE_SETS, TILE_SIZES } from '../data/tilesets.js';
import { debounce, shortId } from '../../../../common/utils.js';
import Engine from '../engine/Engine.js';
import { applyDifficultyPreset } from '../engine/difficultyPresets.js';

/**
 * Use this class to manage the preview render pipeline for the Mahjongg
 * settings dialog.
 */
export default class PreviewGenerator {
	/**
	 * Create a preview generator bound to a host root and completion callback.
	 *
	 * @param {HTMLElement} root - Host node where the preview source tree will be mounted.
	 * @param {{onRenderComplete?: Function}} [options] - Optional callback configuration.
	 */
	constructor(root, {onRenderComplete} = {}) {
		this.root = root;
		this.onRenderComplete = onRenderComplete;
		this.instanceId = shortId();
		this.reactRoot = createRoot(root);
		this.engine = new Engine();
		this.maxTileSize = null;
		this.tileSize = null;
		this.tileStyle = null;
		this.layout = null;
		this.difficulty = 'standard';
		this.boardNbr = 1;
		this.renderCount = 0;
		this.lastResult = null;
		this.destroyed = false;
		this.renderQueued = false;
		this.renderToken = 0;
		this.renderDebounced = debounce(() => {
			this.generateRender();
		}, 80, 300);
	}

	getLayoutDefinition() {
		if (!this.layout) {
			return null;
		}

		if (typeof this.layout === 'string') {
			return layouts[this.layout] || null;
		}

		return this.layout;
	}

	getTileSizeKey() {
		if (this.tileSize && TILE_SIZES[this.tileSize]) {
			return this.tileSize;
		}

		if (this.maxTileSize && TILE_SIZES[this.maxTileSize]) {
			return this.maxTileSize;
		}

		return 'tiny';
	}

	getTileStyleKey() {
		if (this.tileStyle && TILE_SETS[this.tileStyle]) {
			return this.tileStyle;
		}

		return 'ivory';
	}

	buildTiles() {
		var layout = this.getLayoutDefinition();

		if (!layout) {
			return [];
		}

		this.engine.setLayout(layout);
		applyDifficultyPreset(this.engine, this.difficulty);
		this.engine.generateGame(this.boardNbr);

		if (!this.engine.board?.pieces) {
			return [];
		}

		return this.engine.board.pieces.map(function(piece, idx) {
			var {x, y, z} = piece.pos;

			return {
				id: idx,
				x,
				y,
				z,
				face: piece.face,
			};
		});
	}

	/**
	 * Set the maximum allowed tile size for the current UI-size mode.
	 *
	 * @param {string} maxTileSize - Largest tile size key available in the current mode.
	 */
	setMaxTileSize(maxTileSize) {
		this.maxTileSize = maxTileSize;
		this.scheduleRender();
	}

	/**
	 * Set the currently selected tile size for the preview render.
	 *
	 * @param {string} tileSize - Selected tile size key.
	 */
	setTileSize(tileSize) {
		this.tileSize = tileSize;
		this.scheduleRender();
	}

	/**
	 * Set the currently selected tile style for the preview render.
	 *
	 * @param {string} tileStyle - Selected tile style key.
	 */
	setTileStyle(tileStyle) {
		this.tileStyle = tileStyle;
		this.scheduleRender();
	}

	/**
	 * Set the currently selected layout for the preview render.
	 *
	 * @param {string} layout - Selected layout id.
	 */
	setLayout(layout) {
		this.layout = layout;
		this.scheduleRender();
	}

	setDifficulty(difficulty) {
		this.difficulty = difficulty || 'standard';
		this.scheduleRender();
	}

	/**
	 * Schedule a preview render after changes have settled.
	 */
	scheduleRender() {
		if (this.destroyed) {
			return;
		}

		this.renderQueued = true;
		this.renderDebounced();
	}

	/**
	 * Call this method to immediately render the preview and fire the
	 * completion callback without waiting for the debounce window.
	 */
	renderNow() {
		if (this.destroyed) {
			return;
		}

		this.renderQueued = false;
		this.generateRender();
	}

	/**
	 * Generate the preview render and eventually notify the completion
	 * callback with the result payload.
	 */
	generateRender() {
		if (this.destroyed) {
			return;
		}

		this.renderQueued = false;
		this.renderCount += 1;
		this.renderToken += 1;

		var renderToken = this.renderToken;

		this.reactRoot.render(
			React.createElement(PreviewWrapper, {
				className: 'mj-preview-generator-source',
				maxTilesize: this.maxTileSize || this.getTileSizeKey(),
				tiles: this.buildTiles(),
				tileset: this.getTileStyleKey(),
				tilesize: this.getTileSizeKey(),
				tilesets: TILE_SETS,
				tilesizes: TILE_SIZES,
			})
		);

		requestAnimationFrame(async () => {
			if (this.destroyed) {
				return;
			}

			var sourceNode = this.root.firstElementChild || this.root;
			var rect = sourceNode.getBoundingClientRect();
			var imageUrl = null;
			var bitmap = null;
			var captureOptions = {
				cacheBust: true,
				pixelRatio: 1,
				skipFonts: true,
			};

			try {
				imageUrl = await toPng(sourceNode, captureOptions);
				bitmap = await toBlob(sourceNode, captureOptions);
			} catch (err) {
				console.error(err);
			}

			if (this.destroyed || renderToken !== this.renderToken) {
				return;
			}

			var result = {
				instanceId: this.instanceId,
				renderCount: this.renderCount,
				maxTileSize: this.maxTileSize,
				tileSize: this.tileSize,
				tileStyle: this.tileStyle,
				layout: this.layout,
				canvasSize: {
					width: Math.round(rect.width),
					height: Math.round(rect.height),
				},
				imageUrl,
				bitmap,
				sourceNode,
			};

			this.lastResult = result;

			if (this.onRenderComplete) {
				this.onRenderComplete(result);
			}
		});
	}

	/**
	 * Dispose any mounted preview state and release held resources.
	 */
	destroy() {
		if (this.destroyed) {
			return;
		}

		this.destroyed = true;
		this.renderQueued = false;
		this.lastResult = null;
		this.reactRoot.unmount();
	}
}
