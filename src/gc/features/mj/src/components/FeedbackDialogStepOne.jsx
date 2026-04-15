import React from "react";

export default function FeedbackDialogStepOne(props) {
	return (
		<div className="mj-feedback-dialog-section mj-feedback-dialog-questions">
			<h3 className="mj-feedback-dialog-heading">Quick questions</h3>
			<div className="mj-feedback-dialog-question-grid">
				<div className="mj-feedback-dialog-question">
					<div className="mj-feedback-dialog-question-label">
						Did you think the game was easy?
					</div>
					<div
						className="mj-feedback-dialog-choice-list"
						role="radiogroup"
						aria-label="Board difficulty feeling"
					>
						{props.renderChoiceButtons(
							props.difficultyFeelings,
							props.difficultyFeeling,
							props.onSelectDifficultyFeeling
						)}
					</div>
				</div>

				<div className="mj-feedback-dialog-question">
					<div className="mj-feedback-dialog-question-label">
						If you encountered any challenges, how did you feel?
					</div>
					<div
						className="mj-feedback-dialog-choice-list"
						role="radiogroup"
						aria-label="Board fairness feeling"
					>
						{props.renderChoiceButtons(
							props.fairnessFeelings,
							props.fairnessFeeling,
							props.onSelectFairnessFeeling
						)}
					</div>
				</div>

				<div className="mj-feedback-dialog-question mj-feedback-dialog-question-skill">
					<div className="mj-feedback-dialog-question-label">
						What best describes your skill level?
					</div>
					<div
						className="mj-feedback-dialog-choice-list"
						role="radiogroup"
						aria-label="Skill level"
					>
						{props.renderChoiceButtons(
							props.skillLevels,
							props.skillLevel,
							props.onSelectSkillLevel
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
