import React, { Component } from "react";
import Matrix from "./Matrix.jsx";

export default class Tetronomo extends Component {

	render() {
		return (
			<React.Fragment>
				<Matrix {...this.props} />
			</React.Fragment>
		)
	}
}
