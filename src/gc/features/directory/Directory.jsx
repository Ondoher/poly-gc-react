import React from "react";
import GameCenterContext from 'common/GameCenterContext.js';
import Page from 'components/Page.jsx'
import './styles/directory.css'

export default class Directory extends React.Component {
    static contextType = GameCenterContext;
	constructor (props) {
		super(props);
		this.state = {
			directory: this.props.directory,
		}
	}

	get() {

	}

	added(card) {
		var directory = this.state.directory;
		directory[card.name] = card;

		this.setState({directory: directory});
	}

	onCardClick(card) {
		this.directoryService.fire('clicked', card);
	}

	renderCard(card) {
		return (
			<div className="directory-card template" onClick={this.onCardClick.bind(this, card)} key={card.name}>
				<img className="card-image" src={card.image}/>
				<div className="card-name">{card.name}</div>
			</div>
		);
	}

	renderCards() {
		var directory = this.state.directory
		var names = Object.keys(directory)
		return names.map(function(name) {
			var card = directory[name];
			return this.renderCard(card);
		}, this);
	}


	componentDidMount() {
		var registry = this.context.registry;

		this.serviceName = this.props.serviceName;
		this.directoryService = registry.subscribe(this.serviceName);
		this.directoryService.listen('added', this.added.bind(this));

		this.setState({
			ready: true
		})
	}

	render() {
		if (!this.state.ready) return;
		return (
			<Page serviceName={this.serviceName} className="page directory-page">
				<div className="directory-scroller clearfix">
					<div className="directory-container clearfix">
						{this.renderCards()}
					</div>
				</div>
			</Page>
		)

	}


}
