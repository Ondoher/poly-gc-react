import React from 'react';
import FalseSkyScene from './FalseSkyScene.jsx';

export default class FalseSimulationPage extends React.Component {
	constructor(props) {
		super(props);
		this.state = props.pageView?.getState?.() || {};
	}

	componentDidMount() {
		this.updatedListener = this.props.pageView?.listen?.(
			'updated',
			(state) => this.setState(state),
		);
	}

	componentWillUnmount() {
		if (this.props.pageView && this.updatedListener) {
			this.props.pageView.unlisten('updated', this.updatedListener);
		}
	}

	render() {
		const scene = this.state.scene;

		return (
			<section className="false-simulation-page">
				<header className="false-simulation-header">
					<div>
						<h2>False Simulation</h2>
						<p>{this.state.status}</p>
					</div>
					{scene ? (
						<div className="false-simulation-meta">
							<span>{scene.root.name}, {scene.root.admin1}</span>
							<strong>{scene.time}</strong>
						</div>
					) : null}
				</header>
				<div className="false-simulation-stage" aria-label="False simulation preview">
					<FalseSkyScene scene={scene} />
				</div>
			</section>
		);
	}
}
