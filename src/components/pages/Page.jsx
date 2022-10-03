import React from "react";
import {registry} from '@polylith/core';

function delayPromise(duration) {
      return new Promise(function(resolve, reject){
        setTimeout(function(){
          resolve(...args);
        }, duration)
      });
}
export default class Page extends React.Component {
    constructor (props) {
        super(props);

        this.name = props.name;
        this.serviceName = props.serviceName;

        this.parentService = registry.subscribe(this.serviceName);
        this.parentService.listen('show', this.show.bind(this));
        this.parentService.listen('hide', this.hide.bind(this));

        this.pagesService = registry.subscribe(props.pagesServiceName);
        this.pageService = registry.subscribe(props.pageServiceName);

        registry.extendService(props.pageServiceName, this, ['show', 'hide']);

        this.state = {
            visible: false,
        }
    }

    componentDidMount() {
        this.parentService.fire('sendVisibility');
    }

    show () {
        this.setState({visible: true});
    }

    hide () {
        this.setState({visible: false});
    }

    render () {
        var visible = this.state.visible;
        var display = visible ? 'block' : 'none';

        return (
            <div style={{display: display}} id={this.props.id} className={this.props.className}>
                {this.props.children}
            </div>
        )
    }

}
