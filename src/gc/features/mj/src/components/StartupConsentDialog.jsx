import React from "react";
import ModalDialog from "./ModalDialog.jsx";
import SettingsButton from "./SettingsButton.jsx";

export default class StartupConsentDialog extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			draftDifficulty: props.difficulty,
			telemetryConsent: props.telemetryConsent === true,
		};
	}

	componentDidUpdate(prevProps) {
		if (!prevProps.open && this.props.open) {
			this.setState({
				draftDifficulty: this.props.difficulty,
				telemetryConsent: this.props.telemetryConsent === true,
			});
		}
	}

	onToggleTelemetryConsent() {
		this.setState(function (prevState) {
			return {
				telemetryConsent: !prevState.telemetryConsent,
			};
		});
	}

	onSelectDifficulty(draftDifficulty) {
		this.setState({
			draftDifficulty,
		});
	}

	onConfirm() {
		if (!this.props.onConfirm) {
			return;
		}

		this.props.onConfirm({
			telemetryConsent: this.state.telemetryConsent === true,
			difficulty: this.state.draftDifficulty,
		});
	}

	renderDifficultyOptions() {
		return Object.keys(this.props.difficulties || {}).map(function (name) {
			var difficulty = this.props.difficulties[name];
			var selected = this.state.draftDifficulty === difficulty.id;

			return (
				<SettingsButton
					key={difficulty.id}
					className="mj-startup-consent-difficulty-option"
					selected={selected}
					onClick={this.onSelectDifficulty.bind(this, difficulty.id)}
				>
					{difficulty.label}
				</SettingsButton>
			);
		}, this);
	}

	render() {
		if (!this.props.open) return null;

		return (
			<ModalDialog
				open={this.props.open}
				className="mj-startup-consent-dialog"
				panelClassName="mj-startup-consent-panel"
				bodyClassName="mj-startup-consent-body"
				title="Welcome"
				titleId="mj-startup-consent-title"
				closeLabel="Close welcome dialog"
				onClose={this.props.onClose}
				actions={
					<SettingsButton
						className="mj-startup-consent-confirm"
						selected={false}
						onClick={this.onConfirm.bind(this)}
					>
						Close
					</SettingsButton>
				}
			>
						<div className="mj-startup-consent-section">
							<h3 className="mj-startup-consent-heading">
								Help us make this game better
							</h3>
							<p className="mj-startup-consent-copy">
								We're running some user experience experiments and
								would really appreciate your help. If you check
								this box it will allow us to collect anonymous information
								about how you play the game. You also always
								have an opportunity to give us feedback.
							</p>
							<button
								type="button"
								className="mj-startup-consent-checkbox"
								role="checkbox"
								aria-checked={this.state.telemetryConsent ? "true" : "false"}
								onClick={this.onToggleTelemetryConsent.bind(this)}
							>
								<span
									className={
										this.state.telemetryConsent
											? "mj-startup-consent-checkbox-box is-checked"
											: "mj-startup-consent-checkbox-box"
									}
									aria-hidden="true"
								>
									<span className="mj-startup-consent-checkbox-mark">
										✓
									</span>
								</span>
								<span className="mj-startup-consent-checkbox-copy">
									Yes, I like fun
								</span>
							</button>
						</div>
						<div className="mj-startup-consent-section">
							<h3 className="mj-startup-consent-heading">
								Starting difficulty
							</h3>
							<p className="mj-startup-consent-copy">
								Choose the difficulty you want to start with. You can
								change this later in settings.
							</p>
							<div className="mj-startup-consent-difficulty-grid">
								{this.renderDifficultyOptions()}
							</div>
						</div>
			</ModalDialog>
		);
	}
}
