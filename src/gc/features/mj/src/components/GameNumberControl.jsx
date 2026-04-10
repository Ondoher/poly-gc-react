import React from "react";
import CssRect from "./CssRect.jsx";

export default class GameNumberControl extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			boardNbr: this.formatBoardNbr(props.boardNbr),
		};

		if (props.delegator) {
			props.delegator.delegateOutbound(this, ['play']);
		}
	}

	formatBoardNbr(boardNbr) {
		if (boardNbr === undefined || boardNbr === null || boardNbr === -1) {
			return '';
		}

		return String(boardNbr);
	}

	componentDidUpdate(prevProps) {
		if (prevProps.boardNbr !== this.props.boardNbr) {
			this.setState({
				boardNbr: this.formatBoardNbr(this.props.boardNbr),
			});
		}
	}

	onChange(evt) {
		var value = evt.target.value.replace(/[^\d]/g, '');
		this.setState({boardNbr: value});
	}

	onKeyDown(evt) {
		if (evt.key !== 'Enter') return;

		var boardNbr = Number(this.state.boardNbr);
		if (!boardNbr || boardNbr < 1) return;
		if (this.play) this.play(boardNbr);
	}

	onShuffle() {
		if (this.props.onShuffle) {
			this.props.onShuffle();
			return;
		}

		if (this.play) {
			this.play(-1);
		}
	}

	render() {
		return (
			<CssRect
				className="mj-game-number-wrap mj-game-number-control"
				size="small"
				variant="inset"
			>
				<input
					className="mj-text-edit-control-input mj-game-number-input"
					type="text"
					inputMode="numeric"
					pattern="[0-9]*"
					placeholder="Game #"
					aria-label="Game number"
					value={this.state.boardNbr}
					onChange={this.onChange.bind(this)}
					onKeyDown={this.onKeyDown.bind(this)}
				/>
				<button
					type="button"
					className="mj-shuffle-button-control mj-css-rect-separator-left"
					aria-label="Shuffle board"
					onClick={this.onShuffle.bind(this)}
				>
					<span className="mj-shuffle-button-icon"></span>
				</button>
			</CssRect>
		)
	}
}
