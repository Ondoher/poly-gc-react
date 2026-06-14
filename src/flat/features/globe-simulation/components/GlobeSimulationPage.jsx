import React from 'react';
import GlobeSkyScene from './GlobeSkyScene.jsx';

/**
 * Render the globe calibration page shell.
 *
 * @extends {React.Component<{ pageView: GlobeSimulationView }>}
 */
export default class GlobeSimulationPage extends React.Component {
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

	renderMetric(label, value) {
		return (
			<div className="globe-simulation-metric" key={label}>
				<span>{label}</span>
				<strong>{value}</strong>
			</div>
		);
	}

	renderNumber(value, fractionDigits = 1) {
		const number = Number(value);

		return Number.isFinite(number) ? number.toFixed(fractionDigits) : '';
	}

	render() {
		const scene = this.state.scene;
		const root = scene?.root;
		const sun = scene?.sun;
		const solarSource = sun?.source || {};
		const irradiance = sun?.irradiance || {};
		const display = scene?.display || {};

		return (
			<section className="globe-simulation-page">
				<header className="globe-simulation-header">
					<div>
						<h2>Globe Simulation</h2>
						<p>{this.state.status}</p>
					</div>
					{root ? (
						<div className="globe-simulation-meta">
							<span>{root.name}, {root.admin1}</span>
							<strong>{scene.time}</strong>
						</div>
					) : null}
				</header>
				<div className="globe-simulation-stage" aria-label="Globe simulation calibration shell">
					<div className="globe-simulation-visual">
						<GlobeSkyScene scene={scene} />
					</div>
					<div className="globe-simulation-panel">
						{this.renderMetric('Geometry', scene?.geometry?.kind || '')}
						{this.renderMetric('Atmosphere', scene?.atmosphere?.frame?.kind || '')}
						{this.renderMetric('Sun altitude', `${sun?.altitudeDeg ?? ''} deg`)}
						{this.renderMetric('Sun azimuth', `${sun?.azimuthDeg ?? ''} deg`)}
						{this.renderMetric('Solar source', solarSource.model || '')}
						{this.renderMetric('TOA irradiance', `${this.renderNumber(irradiance.topOfAtmosphereIrradianceWm2)} W/m2`)}
						{this.renderMetric('Direct normal', `${this.renderNumber(irradiance.directNormalIrradianceAtObserverWm2)} W/m2`)}
						{this.renderMetric('Direct horizontal', `${this.renderNumber(irradiance.directHorizontalIrradianceAtObserverWm2)} W/m2`)}
						{this.renderMetric('Diffuse estimate', `${this.renderNumber(irradiance.estimatedDiffuseSkyIrradianceWm2)} W/m2`)}
						{this.renderMetric('Renderer source', this.renderNumber(irradiance.renderer?.atmosphereSourceScale, 2))}
						{this.renderMetric('Display model', display.model || '')}
						{this.renderMetric('Exposure', this.renderNumber(display.exposure, 2))}
						{this.renderMetric('Tone mapping', display.toneMapping || '')}
						{this.renderMetric('Radiometric scale', this.renderNumber(display.radiometricToSceneRgbScale, 5))}
					</div>
				</div>
			</section>
		);
	}
}
