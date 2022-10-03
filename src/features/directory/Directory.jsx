import React from "react";
import {registry} from '@polylith/core';
import Page from '../../components/pages/Page'
import './styles/directory.css'

export default class Directory extends React.Component {
    constructor (props) {
        super(props);

        this.serviceName = props.serviceName;
        this.directoryService = registry.subscribe(this.serviceName);
        this.directoryService.listen('added', this.added.bind(this));

        this.state = {
            directory: {},
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
        this.directorysService.fire('clicked', card);
    }

    renderCard(card) {
        return (
            <div className="directory-card template" onclick={this.onCardClick.bind(this, card)}>
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

    render() {
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
