import React from "react";
import {registry} from '@polylith/core';
import './styles/bread-crumbs.css';


export default class BreadCrumbs extends React.Component {
    constructor (props) {
        super(props);

        this.serviceName = props.serviceName;
        registry.makeService(this.serviceName, this, ['clear', 'add']);

        this.state = {
            crumbs: []
        };
    }

    add (name, id, service) {
        var crumb = {
            pos: this.crumbs.length,
            name: name,
            id: id,
            service: service,
        };

        var crumbs = this.state.crumbs;
        crumbs.push(crumb);

        this.setState({crumbs: crumbs})
    }

    clear () {
        this.setState({crumbs: []})
    }

    renderCrumb (crumb)  {
        return (
            <span id="bread-crumb" className="bread-crumb template">
	            <span className="name" onclick={this.onCrumbClick.bind(this, crumb)}>crumb.name</span>
            </span>            
        )
    }

    renderCrumbs() {
		return this.state.crumbs.map(function(crumb) {
            this.renderCrumb(crumb);
	    }, this);
    }

    render() {
        return (
            <div id="bread-crumbs" className="bread-crumbs">
                {this.renderCrumbs()}
            </div>
        )
    }

    onCrumbClick (crumb) {
        var service = registry.subscribe(crumb.service);
        var crumbs = this.state.crumbs;
        crumbs = this.crumbs.slice(0, crumb.pos);
        this.setState({crumbs: crumbs});

        if (service) service.invoke('crumbClick', crumb.id);
    }
}
