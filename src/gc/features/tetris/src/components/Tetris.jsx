import React, { Component } from "react";
import PlayMatrix from "./PlayMatrix";
import Page from 'components/Page.jsx'
import Matrix from "./Matrix";

export default class Tetris extends Component {
	constructor (props) {
		super(props);

		props.delegator.delegateInbound(this, [
			'drawOnDeck', 'drawHold', 'drawScore', 'startGame', 'drawGameOver'
		]);
		props.delegator.delegateOutbound(this, ['play']);

		this.state = {gameOver: false}
	}


	onPlayClick() {
		this.play();
	}

	smallMessage(message) {
		if (this.smallMessageTimer) clearInterval(this.smallMessageTimer);
		this.smallMessageTimer = setInterval(this.smallMessageTick.bind(this), 50)
		this.setState({smallMessage: {message: message, start: Date.now()}});
	}


	smallMessageTick() {
		var timeout = 2000;
		var message = this.state.smallMessage;
		if (!message) {
			return;
		}

		var delta = Date.now() - message.start;;
		if (delta > timeout) {
			this.setState({smallMessage: false})
			clearInterval(this.smallMessageTimer);
			return;
		}

		var opacity = 1 - delta / timeout;
		message.opacity = opacity;
		this.setState({smallMessage: message})
	}

	startGame() {
		this.setState({gameOver: false})
	}

	drawGameOver() {
		console.log('GAME OVER!')
		this.setState({gameOver: true})
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
			this.smallMessage(`${comment} ${points} points'`)
		}
	}

	renderHold() {
		var {hold = false} = this.state;
		if (!hold) return;

		console.log('rendering hold', hold)
		var className = `game-hold-matrix tetris-small matrix`;
		return (
			<div className="game-hold">
				<div key='hold' className={className}>
					<Matrix matrix={hold}/>
				</div>
			</div>
		)
	}

	renderOneOnDeck(idx, matrix) {
		var classNames = ['game-ondeck-one', 'game-ondeck-two', 'game-ondeck-three']
		var className = `tetris-small matrix ${classNames[idx]}`;
		return (
			<div key={`ondeck-${idx}`}className={className}>
				<Matrix matrix={matrix}/>
			</div>
		)
	}
	renderOnDeck() {
		if (!this.state.onDeck) return;
		console.log('renderOnDeck', this.state.onDeck)
		var onDeck = this.state.onDeck.map(function(onDeck, idx)
		{
			return this.renderOneOnDeck(idx, onDeck);
		}, this)

		return (
			<div className="game-ondeck">
				{onDeck}
			</div>
		)
	}


	renderSmallMessage() {
		var {smallMessage = false} = this.state;
		if (!smallMessage) return;
		var styles = {opacity: smallMessage.opacity}
		return (
			<div className="stats">
				<div className="score"></div>
				<div className="level" style={styles}>{smallMessage.message}</div>
				<div className="goal"></div>
			</div>
		)
	}

	renderStats() {
		var {score, level = 1, goal = 10, smallMessage = false} = this.state;
		if (smallMessage) return;
		return (
			<div className="stats">
				<div className="score">SCORE: {score}</div>
				<div className="level">LEVEL: {level}</div>
				<div className="goal">GOAL: {goal}</div>
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

	renderGameLeft() {
		return (
			<div className="game-left">
				{this.renderHold()}
			</div>
		)
	}

	renderGameOver() {
		if (!this.state.gameOver) return;
		return (
			<div className="game-over">GAME OVER</div>
		)
	}

	renderPlayArea() {
		return (
			<div className="game-play">
				<PlayMatrix
					delegator = {this.props.delegator}
				/>
			</div>
		)
	}


	renderMain() {
		return (
			<div className="game-main">
				{this.renderStats()}
				{this.renderSmallMessage()}
				{this.renderGameLeft()}
				{this.renderPlayArea()}
				{this.renderGameRight()}
				{this.renderGameOver()}
			</div>
		)
	}


	renderHeader() {
		return (
			<div className="game-header">
				<div className="play-button" onClick={this.onPlayClick.bind(this)}/>
			</div>
		)

	}

	renderGameSpace() {
		return (
			<div className="tetris-game">
				{this.renderHeader()}
				{this.renderMain()}
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
