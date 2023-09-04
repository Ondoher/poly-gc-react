import React, { Component } from "react";
import PlayMatrix from "./PlayMatrix";
import Page from 'components/Page.jsx'
import Matrix from "./Matrix";

export default class Tetris extends Component {
	constructor (props) {
		super(props);

		this.state = {gameOver: false, paused: false}
		this.playMatrixDelegator = this.props.delegator.newDelegator();
		this.messages = [];
	}

	componentDidMount() {
		if (this.props.delegator) {
			this.props.delegator.delegateInbound(this, [
				'drawOnDeck', 'drawHold', 'drawScore', 'drawLevel', 'startGame', 'drawPaused', 'drawGameOver'
			]);
			this.props.delegator.delegateOutbound(this, ['play', 'escape', 'pause', 'resume']);
		}
	}

	componentWillUnmount() {
		if (this.props.delegator) {
			this.props.delegator.freeDelegator();
		}
	}

	onPlayClick() {
		this.play();
	}

	onPauseClick() {
		this.pause();
	}

	onResumeClick() {
		this.resume();
	}

	queueMessage(message) {
		this.messages.push({message: message, start: Date.now(), opacity: 1})
	}

	dequeueMessage() {
		this.messages.shift();

		// if there is a new message, start the opacity clock now
		if (this.messages.length !== 0) {
			this.messages[0].start = Date.now();
			return true
		}

		return false;
	}

	getCurrentMessage() {
		return this.messages[0];
	}

	message(message) {
		this.queueMessage(message);
		this.setState({messages: true});
		if (!this.messageTimer) this.messageTimer = setInterval(this.messageTick.bind(this), 50)
	}

	messageTick() {
		var timeout = 2000;
		var message = this.getCurrentMessage();
		if (!message === 0) {
			return;
		}

		var delta = Date.now() - message.start;
		// message timed out, setup for next
		if (delta > timeout) {
			if (!this.dequeueMessage()) {
				clearInterval(this.messageTimer)
				this.messageTimer = false;
				this.setState({messages: false})
			}
			return;
		}

		var opacity = 1 - delta / timeout;
		message.opacity = opacity;
		this.setState({messageDelta: delta})
	}

	startGame() {
		this.setState({gameOver: false})
	}

	drawGameOver() {
		this.setState({gameOver: true})
	}

	drawPaused(paused) {
		this.setState({paused: paused})
	}
	drawOnDeck(pieces) {
		this.setState({onDeck: pieces})
	}

	drawHold(matrix) {
		this.setState({hold: matrix})
	}

	drawScore(points, score, comment) {
		this.setState({score: score});
		if (comment) {
			this.message(`${comment} ${points} points`)
		}
	}

	drawLevel(goal, level, comment)
	{
		this.setState({goal, level});
		if (comment) {
			this.message(comment)
		}
	}

	renderHold() {
		var {hold = false} = this.state;
		if (!hold) return;

		var className = `game-hold-matrix tetris-normal-side matrix`;
		return (
			<div className="game-hold">
				<div className="hold-title">HOLD</div>
				<div className="hold-pieces">
					<div className={className}>
						<Matrix matrix={hold}/>
					</div>
				</div>
			</div>
		)
	}

	renderOneOnDeck(idx, matrix) {
		var classNames = ['game-ondeck-one', 'game-ondeck-two', 'game-ondeck-three']
		var className = `tetris-normal-side matrix ${classNames[idx]}`;
		return (
			<div key={`ondeck-${idx}`} className={className}>
				<Matrix matrix={matrix}/>
			</div>
		)
	}
	renderOnDeck() {
		if (!this.state.onDeck) return;
		var onDeck = this.state.onDeck.map(function(onDeck, idx)
		{
			return this.renderOneOnDeck(idx, onDeck);
		}, this)

		return (
			<div className="game-ondeck">
				<div className="ondeck-title">NEXT</div>
				<div className="ondeck-pieces">
					{onDeck}
				</div>
			</div>
		)
	}

	renderMessage() {
		var message = this.getCurrentMessage();
		if (!message) return;
		var styles = {opacity: message.opacity}

		return (
			<div className="small-message">
				<div style={styles}>{message.message}</div>
			</div>
		)
	}

	renderStats() {
		var {score, level = 1, goal = 10, messages} = this.state;
		if (messages) return;
		return (
			<div className="stats">
				<div className="score-title">SCORE</div>
				<div className="level-title">LEVEL</div>
				<div className="goal-title">GOAL</div>
				<div className="score">{score}</div>
				<div className="level">{level}</div>
				<div className="goal">{goal}</div>
			</div>
		)
	}

	renderGameRight() {
		return (
			<div className="game-right">
				{this.renderOnDeck()}
			</div>
		)
	}

	renderPlayButton() {
		return(
			<div className="play-button" onClick={this.onPlayClick.bind(this)}></div>
		)
	}

	renderPauseButton() {
		if (this.state.paused) return;
		return(
			<div className="pause-button" onClick={this.onPauseClick.bind(this)}></div>
		)
	}

	renderResumeButton() {
		if (!this.state.paused) return;
		return(
			<div className="resume-button" onClick={this.onResumeClick.bind(this)}></div>
		)
	}

	renderGameLeft() {
		return (
			<div className="game-left">
				{this.renderHold()}
				{this.renderPlayButton()}
				{this.renderPauseButton()}
				{this.renderResumeButton()}
			</div>
		)
	}

	renderGameOver() {
		if (!this.state.gameOver) return;
		return (
			<div className="gameover-cover" onClick={this.escape.bind(this)}>
				<div className="gameover"></div>
			</div>
		)
	}

	renderPlayArea() {
		var playMatrix = !this.state.paused ?
			<PlayMatrix delegator = {this.playMatrixDelegator}	/> :
			''
		return (
			<div className="game-play">
				<div className="game-play-grid">
					{playMatrix}
				</div>
			</div>
		)
	}

	renderMain() {
		return (
			<div className="game-main">
				{this.renderStats()}
				{this.renderMessage()}
				{this.renderGameLeft()}
				{this.renderPlayArea()}
				{this.renderGameRight()}
			</div>
		)
	}


	renderHeader() {
		return (
			<div className="game-header">
				<div className="game-title"></div>
			</div>
		)
	}

	renderGameSpace() {
		return (
			<div className="tetris-game">
				{this.renderHeader()}
				{this.renderMain()}
				{this.renderGameOver()}
			</div>
		)
	}

	render() {
		var className = `tetris-normal matrix`;
		var pageClassName = 'page tetris-page ';
		return (
			<Page serviceName={this.props.serviceName} className={pageClassName}>
				<div className="tetris-content">
					{this.renderGameSpace()}
				</div>
			</Page>
		);
	}
}
