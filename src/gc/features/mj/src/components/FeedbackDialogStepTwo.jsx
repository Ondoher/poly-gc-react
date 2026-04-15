import React from "react";

export default function FeedbackDialogStepTwo(props) {
	return (
		<div className="mj-feedback-dialog-context-comments">
			<div className="mj-feedback-dialog-section mj-feedback-dialog-context">
				<h3 className="mj-feedback-dialog-heading">About Your Game</h3>
				<div className="mj-feedback-dialog-context-grid">
					<div className="mj-feedback-dialog-context-item">
						<span className="mj-feedback-dialog-context-label">Game number</span>
						<span className="mj-feedback-dialog-context-value">{props.boardNbr}</span>
					</div>
					<div className="mj-feedback-dialog-context-item">
						<span className="mj-feedback-dialog-context-label">Difficulty</span>
						<span className="mj-feedback-dialog-context-value">{props.difficultyLabel}</span>
					</div>
					<div className="mj-feedback-dialog-context-item">
						<span className="mj-feedback-dialog-context-label">Layout</span>
						<span className="mj-feedback-dialog-context-value">{props.layoutTitle}</span>
					</div>
				</div>
				{props.canIncludeContext ? (
					<React.Fragment>
						<p className="mj-feedback-dialog-copy">
							This can also include basic play information such as tile choices,
							undo and redo use, peek use, and game duration.
						</p>
						<button
							type="button"
							className="mj-feedback-dialog-checkbox"
							role="checkbox"
							aria-checked={props.includeContext ? "true" : "false"}
							onClick={props.onToggleIncludeContext}
						>
							<span
								className={
									props.includeContext
										? "mj-feedback-dialog-checkbox-box is-checked"
										: "mj-feedback-dialog-checkbox-box"
								}
								aria-hidden="true"
							>
								<span className="mj-feedback-dialog-checkbox-mark">&#10003;</span>
							</span>
							<span className="mj-feedback-dialog-checkbox-copy">
								Include this game context with my feedback
							</span>
						</button>
					</React.Fragment>
				) : null}
			</div>

			<div className="mj-feedback-dialog-section mj-feedback-dialog-comments">
				<h3 className="mj-feedback-dialog-heading">Comments</h3>
				<label className="mj-feedback-dialog-comment-field">
					<textarea
						className="mj-feedback-dialog-comment-input"
						placeholder="Anything else you'd like us to know?"
						value={props.comment}
						onChange={props.onChangeComment}
					></textarea>
				</label>
			</div>
		</div>
	);
}
