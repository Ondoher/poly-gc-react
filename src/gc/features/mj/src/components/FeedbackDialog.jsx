import React from "react";
import ModalDialog from "./ModalDialog.jsx";
import FeedbackDialogStepOne from "./FeedbackDialogStepOne.jsx";
import FeedbackDialogStepTwo from "./FeedbackDialogStepTwo.jsx";
import SettingsButton from "./SettingsButton.jsx";

const SKILL_LEVELS = [
	{id: "beginner", label: "Beginner"},
	{id: "intermediate", label: "Intermediate"},
	{id: "experienced", label: "Experienced"},
];

const DIFFICULTY_FEELINGS = [
	{id: "too-easy", label: "Too easy"},
	{id: "about-right", label: "About right"},
	{id: "too-hard", label: "Too hard"},
];

const FAIRNESS_FEELINGS = [
	{id: "fair", label: "It was fun"},
	{id: "frustrating", label: "About as expected"},
	{id: "very-frustrating", label: "Made me frustrated"},
];

export default class FeedbackDialog extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			currentStep: 1,
			includeContext: true,
			skillLevel: "",
			difficultyFeeling: "",
			fairnessFeeling: "",
			comment: "",
		};
	}

	componentDidUpdate(prevProps) {
		if (!prevProps.open && this.props.open) {
			this.setState({
				currentStep: 1,
				includeContext: this.props.canIncludeContext !== false,
				skillLevel: "",
				difficultyFeeling: "",
				fairnessFeeling: "",
				comment: "",
			});
		}
	}

	onToggleIncludeContext() {
		this.setState(function(prevState) {
			return {
				includeContext: !prevState.includeContext,
			};
		});
	}

	onSelectSkillLevel(skillLevel) {
		this.setState({
			skillLevel,
		});
	}

	onSelectDifficultyFeeling(difficultyFeeling) {
		this.setState({
			difficultyFeeling,
		});
	}

	onSelectFairnessFeeling(fairnessFeeling) {
		this.setState({
			fairnessFeeling,
		});
	}

	onChangeComment(evt) {
		this.setState({
			comment: evt.target.value,
		});
	}

	onAdvanceStep() {
		this.setState({
			currentStep: 2,
		});
	}

	onRetreatStep() {
		this.setState({
			currentStep: 1,
		});
	}

	onSubmit() {
		if (!this.props.onSubmit) {
			return;
		}

		this.props.onSubmit({
			includeContext: this.state.includeContext,
			skillLevel: this.state.skillLevel,
			difficultyFeeling: this.state.difficultyFeeling,
			fairnessFeeling: this.state.fairnessFeeling,
			comment: this.state.comment.trim(),
		});
	}

	renderChoiceButtons(options, selectedValue, onSelect) {
		return options.map(function(option) {
			return (
				<button
					key={option.id}
					type="button"
					className="mj-feedback-dialog-radio"
					role="radio"
					aria-checked={selectedValue === option.id ? "true" : "false"}
					onClick={onSelect.bind(this, option.id)}
				>
					<span
						className={
							selectedValue === option.id
								? "mj-feedback-dialog-radio-dot is-selected"
								: "mj-feedback-dialog-radio-dot"
						}
						aria-hidden="true"
					>
						<span className="mj-feedback-dialog-radio-dot-inner"></span>
					</span>
					<span className="mj-feedback-dialog-radio-copy">
						{option.label}
					</span>
				</button>
			);
		}, this);
	}

	render() {
		if (!this.props.open) return null;

		const isFirstStep = this.state.currentStep === 1;

		return (
			<ModalDialog
				open={this.props.open}
				className="mj-feedback-dialog"
				panelClassName="mj-feedback-dialog-panel"
				bodyClassName={
					isFirstStep
						? "mj-feedback-dialog-body is-step-one"
						: "mj-feedback-dialog-body is-step-two"
				}
				title="Feedback"
				titleId="mj-feedback-dialog-title"
				closeLabel="Close feedback dialog"
				onClose={this.props.onClose}
				actions={
					<React.Fragment>
						<SettingsButton
							className="mj-feedback-dialog-cancel"
							selected={false}
							onClick={
								isFirstStep
									? this.props.onClose
									: this.onRetreatStep.bind(this)
							}
						>
							{isFirstStep ? "Cancel" : "Back"}
						</SettingsButton>
						<SettingsButton
							className="mj-feedback-dialog-confirm"
							selected={false}
							onClick={
								isFirstStep
									? this.onAdvanceStep.bind(this)
									: this.onSubmit.bind(this)
							}
						>
							{isFirstStep ? "Continue" : "Send feedback"}
						</SettingsButton>
					</React.Fragment>
				}
			>
				<div className="mj-feedback-dialog-step-label">
					{isFirstStep ? "Step 1 of 2" : "Step 2 of 2"}
				</div>
				{isFirstStep ? (
					<FeedbackDialogStepOne
						difficultyFeelings={DIFFICULTY_FEELINGS}
						difficultyFeeling={this.state.difficultyFeeling}
						fairnessFeelings={FAIRNESS_FEELINGS}
						fairnessFeeling={this.state.fairnessFeeling}
						skillLevels={SKILL_LEVELS}
						skillLevel={this.state.skillLevel}
						renderChoiceButtons={this.renderChoiceButtons.bind(this)}
						onSelectDifficultyFeeling={this.onSelectDifficultyFeeling.bind(this)}
						onSelectFairnessFeeling={this.onSelectFairnessFeeling.bind(this)}
						onSelectSkillLevel={this.onSelectSkillLevel.bind(this)}
					/>
				) : (
					<FeedbackDialogStepTwo
						boardNbr={this.props.boardNbr}
						difficultyLabel={this.props.difficultyLabel}
						layoutTitle={this.props.layoutTitle}
						canIncludeContext={this.props.canIncludeContext !== false}
						includeContext={this.state.includeContext}
						comment={this.state.comment}
						onToggleIncludeContext={this.onToggleIncludeContext.bind(this)}
						onChangeComment={this.onChangeComment.bind(this)}
					/>
				)}
			</ModalDialog>
		);
	}
}
