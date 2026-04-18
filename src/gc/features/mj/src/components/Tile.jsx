import React from "react";

function getHideAnimationMs(highlightType, timings) {
	if (highlightType === 'final-played-left' || highlightType === 'final-played-right') return timings.finalPlayed;
	if (highlightType === 'peek') return timings.peek;
	if (highlightType === 'redo') return timings.redo;
	if (highlightType === 'played') return timings.played;

	return timings.played;
}

function normalizeHighlightType(value, defaultType = 'highlight') {
	if (value === false || value === null || value === undefined) return false;
	if (value === true) return defaultType;
	if (typeof value === 'string') return value;

	return defaultType;
}

function getHighlightClasses(highlightType) {
	if (highlightType === false) return [];

	return ['highlight', highlightType].filter(function(name, idx, names) {
		return names.indexOf(name) === idx;
	});
}

export default class Tile extends React.Component {
	constructor (props) {
		super(props);

		this.state = {
			show: true,
			highlight: false
		}

		this.hideTimer = null;
		this.clearHighlightTimer = null;
		this.restartHintTimer = null;
	}

	componentDidMount() {
		if (this.props.delegator) {
			this.props.delegator.delegateInbound(this, [
				'showTile', 'hintTile', 'highlightTile'
			]);
		}
	}

	componentWillUnmount() {
		this.clearHideTimer();
		this.clearHighlightTimerHandle();
		this.clearRestartHintTimer();

		if (this.props.delegator) {
			this.props.delegator.freeDelegator();
		}
	}

	showTile(id, on) {
		if (id !== this.props.id && id !== 'all') return;

		if (on === true) {
			this.clearHideTimer();
			this.setState({
				show: true,
				highlight: false
			});
			return;
		}

		if (typeof on === 'string') {
			var highlightType = normalizeHighlightType(on);
			var timings = this.props.timings;

			this.clearHideTimer();
			this.clearHighlightTimerHandle();
			this.setState({
				show: true,
				highlight: highlightType
			});
			this.hideTimer = setTimeout(function() {
				this.hideTimer = null;
				this.setState({
					show: false,
					highlight: false
				});
			}.bind(this), getHideAnimationMs(highlightType, timings));
			return;
		}

		this.clearHideTimer();
		this.clearHighlightTimerHandle();
		this.setState({
			show: false,
			highlight: false
		});
	}

	hintTile(id, on) {
		if (id !== this.props.id) return;

		var highlight = normalizeHighlightType(on, 'hint');

		if (highlight === 'hint' && this.state.highlight === 'hint') {
			this.clearRestartHintTimer();
			this.setState({
				highlight: false
			});
			this.restartHintTimer = setTimeout(function() {
				this.restartHintTimer = null;
				this.setState({
					highlight: 'hint'
				});
			}.bind(this), 0);
			return;
		}

		this.clearRestartHintTimer();
		this.setState({
			highlight: highlight
		})
	}

	highlightTile(id, on) {
		if (id !== this.props.id && id !== 'all') return;

		var highlight = normalizeHighlightType(on);
		var timings = this.props.timings;

		if (highlight === 'blocked') {
			this.clearHighlightTimerHandle();
			this.setState({
				highlight: 'blocked'
			});
			this.clearHighlightTimer = setTimeout(function() {
				this.clearHighlightTimer = null;
				this.setState(function(prevState) {
					return prevState.highlight === 'blocked'
						? {highlight: false}
						: null;
				});
			}.bind(this), timings.blocked);
			return;
		}

		if (highlight === 'undo') {
			this.clearHighlightTimerHandle();
			this.setState({
				highlight: 'undo'
			});
			this.clearHighlightTimer = setTimeout(function() {
				this.clearHighlightTimer = null;
				this.setState(function(prevState) {
					return prevState.highlight === 'undo'
						? {highlight: false}
						: null;
				});
			}.bind(this), timings.undo);
			return;
		}

		if (highlight === 'restart') {
			this.clearHighlightTimerHandle();
			this.setState({
				highlight: 'restart'
			});
			this.clearHighlightTimer = setTimeout(function() {
				this.clearHighlightTimer = null;
				this.setState(function(prevState) {
					return prevState.highlight === 'restart'
						? {highlight: false}
						: null;
				});
			}.bind(this), timings.restart);
			return;
		}

		if (highlight === false && this.state.highlight === 'selected') {
			// Only animate a true deselection. Matched plays move the tile into
			// the separate "played" state through showTile(), so they skip this.
			this.clearHighlightTimerHandle();
			this.setState({
				highlight: 'unselected'
			});
			this.clearHighlightTimer = setTimeout(function() {
				this.clearHighlightTimer = null;
				this.setState({
					highlight: false
				});
			}.bind(this), timings.unselected);
			return;
		}

		this.clearHighlightTimerHandle();
		this.setState({
			highlight: highlight
		})
	}

	clearHideTimer() {
		if (!this.hideTimer) return;

		clearTimeout(this.hideTimer);
		this.hideTimer = null;
	}

	clearHighlightTimerHandle() {
		if (!this.clearHighlightTimer) return;

		clearTimeout(this.clearHighlightTimer);
		this.clearHighlightTimer = null;
	}

	clearRestartHintTimer() {
		if (!this.restartHintTimer) return;

		clearTimeout(this.restartHintTimer);
		this.restartHintTimer = null;
	}

	render() {
		var {x, y, z, face, onClick} = this.props;
		var {show, highlight} = this.state;
		var highlightType = highlight || (this.props.highlight === true ? 'highlight' : false);
		var bodyClass = 'tile pos-' + x + '-' + y + '-' + z;
		var faceClass = 'face face-' + face;
		var highlightClasses = getHighlightClasses(highlightType);

		if (highlightClasses.length > 0) {
			bodyClass += ' ' + highlightClasses.join(' ');
			faceClass += ' ' + highlightClasses.join(' ');
		}

		if (!show) return '';

		return(
			<React.Fragment>
				<div className={bodyClass}><div className={faceClass} onClick={onClick}></div></div>
			</React.Fragment>
		);
	}
}
