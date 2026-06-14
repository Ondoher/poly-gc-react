import React from 'react';
import FlatSkyScene from './FlatSkyScene.jsx';

export default class FlatSimulationPage extends React.Component {
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
			<section className="flat-simulation-page">
				<header className="flat-simulation-header">
					<div>
						<h2>Flat Simulation</h2>
						<p>{this.state.status}</p>
					</div>
					{scene ? (
						<div className="flat-simulation-meta">
							<span>{scene.root.name}, {scene.root.admin1}</span>
							<strong>{scene.time}</strong>
						</div>
					) : null}
				</header>
				<div className="flat-simulation-stage" aria-label="Flat simulation preview">
					<FlatSkyScene scene={scene} />
				</div>
			</section>
		);
	}
}
