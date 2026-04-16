import React from "react";
import ModalDialog from "./ModalDialog.jsx";

const CONTROL_ITEMS = [
	{icon: "pause", label: "Pause", description: "Stop the timer until you resume play."},
	{icon: "restart", label: "Restart", description: "Start the current game over."},
	{icon: "undo", label: "Undo", description: "Undo the most recently played tiles."},
	{icon: "redo", label: "Redo", description: "Replay the most recently undone pair."},
	{icon: "multi-undo", label: "Multi-level undo", description: "Open undo history and rewind to an earlier move."},
	{icon: "hint", label: "Hint", description: "Show open tile matches."},
	{icon: "peek", label: "Peek", description: "Hide tiles to see what is under them."},
	{icon: "settings", label: "Settings", description: "Change layout, difficulty, tile style, and other options."},
	{icon: "help", label: "Help", description: "This help screen."},
	{icon: "feedback", label: "Feedback", description: "Tell us what you think about the game."},
];

export default class HelpDialog extends React.Component {
	renderControlItems() {
		return CONTROL_ITEMS.map(function(item) {
			return (
				<div className="mj-help-dialog-item" key={item.label}>
					<div className="mj-help-dialog-item-header">
						<span className={`mj-help-dialog-item-icon mj-help-dialog-item-icon-${item.icon}`} aria-hidden="true"></span>
						<div className="mj-help-dialog-item-label">{item.label}</div>
					</div>
					<p className="mj-help-dialog-item-copy">{item.description}</p>
				</div>
			);
		});
	}

	render() {
		if (!this.props.open) return null;

		return (
			<ModalDialog
				open={this.props.open}
				className="mj-help-dialog"
				panelClassName="mj-help-dialog-panel"
				bodyClassName="mj-help-dialog-body"
				title="Help"
				titleId="mj-help-dialog-title"
				closeLabel="Close help dialog"
				onClose={this.props.onClose}
			>
				<div className="mj-help-dialog-section">
					<div className="mj-help-dialog-copy-block">
						<h3 className="mj-help-dialog-heading">Controls</h3>
						<div className="mj-help-dialog-grid">
							{this.renderControlItems()}
						</div>
					</div>
				</div>
			</ModalDialog>
		);
	}
}
