import React from "react";
import CssRect from "./CssRect.jsx";

export default class ModalDialog extends React.Component {
	render() {
		if (!this.props.open) return null;

		var className = "mj-modal-dialog";
		var panelClassName = "mj-modal-dialog-panel";
		var bodyClassName = "mj-modal-dialog-body";

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		if (this.props.panelClassName) {
			panelClassName += ` ${this.props.panelClassName}`;
		}

		if (this.props.bodyClassName) {
			bodyClassName += ` ${this.props.bodyClassName}`;
		}

		return (
			<div
				className={className}
				role="dialog"
				aria-modal="true"
				aria-labelledby={this.props.titleId}
			>
				<div className="mj-modal-dialog-overlay"></div>
				<CssRect
					className={panelClassName}
					size={this.props.size || "large"}
					variant="inset"
				>
					{this.props.onClose ? (
						<button
							type="button"
							className="mj-modal-dialog-close"
							aria-label={this.props.closeLabel || "Close dialog"}
							onClick={this.props.onClose}
						>
							X
						</button>
					) : null}
					{this.props.title ? (
						<h2 id={this.props.titleId} className="mj-modal-dialog-title">
							{this.props.title}
						</h2>
					) : null}
					<div className={bodyClassName}>
						{this.props.children}
					</div>
					{this.props.actions ? (
						<div className="mj-modal-dialog-actions">
							{this.props.actions}
						</div>
					) : null}
				</CssRect>
			</div>
		);
	}
}
