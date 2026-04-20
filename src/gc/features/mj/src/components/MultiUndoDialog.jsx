import React from "react";
import CssRect from "./CssRect.jsx";
import ModalDialog from "./ModalDialog.jsx";
import ScrollPane from "./ScrollPane.jsx";

export default class MultiUndoDialog extends React.Component {
	renderTile(face, which) {
		let className = `mj-multi-undo-dialog-history-tile history-tile-${which}`;
		return (
			<div className={className}>
				<div className="tile">
					<div className={`face face-${face}`}></div>
				</div>
			</div>
		);
	}

	/**
	 *
	 * @param {number} sequence
	 * @return {JSX}
	 */
	renderSequence(sequence) {
		return (
			<span className="mj-redo-sequence">{sequence}</span>
		);
	}

	/**
	 *
	 * @param {RedoPair} pair
	 * @param {number} sequence
	 */
	renderPair(pair, sequence) {
		return (
			<button
				type="button"
				className="mj-redo-pair"
				key={pair.id || `undo-pair-${sequence}`}
				onClick={
					this.props.onChooseHistoryEntry
						? this.props.onChooseHistoryEntry.bind(this, pair.moveNumber)
						: undefined
				}
			>
				{this.renderSequence(pair.moveNumber || sequence + 1)}
				<div className="mj-redo-pair-tiles">
					{this.renderTile(pair.face1, 0)}
					{this.renderTile(pair.face2, 1)}
				</div>
			</button>
		);
	}

	/**
	 *
	 * @param {MultiUndoHistoryEntry[]} pairs
	 * @returns {JSX}
	 */
	renderHistory(pairs) {
		let tiles = pairs.map((pair, idx) => this.renderPair(pair, idx));

		return (
			<div className="mj-redo-history">
				{tiles}
			</div>
		);
	}

	renderNoHistory() {
		return (
			<div className="mj-redo-history mj-history-empty">
				Nothing to undo.
			</div>
		);
	}

	renderHistoryRows() {
		if (this.props.history.length === 0) {
			return this.renderNoHistory();
		}

		return this.renderHistory(this.props.history);
	}

	render() {
		let className = `mj-multi-undo-dialog-body ${this.props.boardClassName}`;

		return (
			<ModalDialog
				open={this.props.open}
				className="mj-multi-undo-dialog is-spacious"
				panelClassName="mj-multi-undo-dialog-panel"
				bodyClassName={className}
				title="Move History"
				titleId="mj-multi-undo-dialog-title"
				closeLabel="Close move history"
				onClose={this.props.onClose}
			>
				<div className="mj-multi-undo-dialog-section">
					<div className="mj-multi-undo-dialog-copy">
						<h3 className="mj-multi-undo-dialog-copy-title">Undo To</h3>
						<p className="mj-multi-undo-dialog-copy-text">
							Choose any move in the played history to rewind the board back to just before that pair was removed.
						</p>
						<p className="mj-multi-undo-dialog-copy-text">
							All later moves will be added back automatically and can still be redone afterward.
						</p>
					</div>
					<CssRect
						className="mj-multi-undo-dialog-history-frame"
						size="large"
						variant="inset"
					>
						<ScrollPane
							className="mj-multi-undo-dialog-history-scroll-pane"
							viewportClassName="mj-multi-undo-dialog-history-viewport"
							scrollClassName="mj-multi-undo-dialog-history-scroll"
							railClassName="mj-multi-undo-dialog-history-rail"
							trackClassName="mj-multi-undo-dialog-history-track"
							thumbClassName="mj-multi-undo-dialog-history-thumb"
						>
							{this.renderHistoryRows()}
						</ScrollPane>
					</CssRect>
				</div>
			</ModalDialog>
		);
	}
}
