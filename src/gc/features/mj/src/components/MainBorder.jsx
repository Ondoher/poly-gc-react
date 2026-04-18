import React from "react";

export default class MainBorder extends React.Component {
	render() {
		var shellClassName = "mj-main-border-shell";

		if (this.props.className) {
			shellClassName += ` ${this.props.className}`;
		}

		return (
			<div className={shellClassName}>
				<div className="mj-main-border-piece mj-main-border-corner mj-main-border-corner-tl"></div>
				<div className="mj-main-border-piece mj-main-border-edge mj-main-border-edge-top"></div>
				<div className="mj-main-border-piece mj-main-border-corner mj-main-border-corner-tr"></div>
				<div className="mj-main-border-piece mj-main-border-edge mj-main-border-edge-left"></div>
				<div className="mj-main-border-center"></div>
				<div className="mj-main-border-piece mj-main-border-edge mj-main-border-edge-right"></div>
				<div className="mj-main-border-piece mj-main-border-corner mj-main-border-corner-bl"></div>
				<div className="mj-main-border-piece mj-main-border-edge mj-main-border-edge-bottom"></div>
				<div className="mj-main-border-piece mj-main-border-corner mj-main-border-corner-br"></div>
			</div>
		);
	}
}
