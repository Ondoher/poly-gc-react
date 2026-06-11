import React from 'react';
import { Button, Pill } from '../../../components/index.js';
import { AssetGlbPreview } from '../../asset-review/components/AssetReviewPage.jsx';

export default class ExperimentsPage extends React.Component {
	constructor(props) {
		super(props);
		this.state = props.pageView.getState();
	}

	componentDidMount() {
		this.updateListener = this.props.pageView.listen('updated', (pageState) => {
			this.setState(pageState);
		});
		this.props.pageView.load({ quiet: true });
	}

	componentWillUnmount() {
		this.props.pageView.unlisten('updated', this.updateListener);
	}

	render() {
		const { experiment, processing, messageDialog } = this.state;
		const variants = experiment?.variants || [];
		const faceKey = experiment?.faceKey || 'flower-3';

		return (
			<section className="experiments-page">
				<header className="experiments-header">
					<div className="experiments-title">
						<h1>Experiments</h1>
						<div className="structure-header-summary experiments-summary">
							<Pill>{faceKey}</Pill>
							<Pill>{variants.length} variants</Pill>
							<Pill reportLevel={variants.some((variant) => !variant.ready) ? 'warning' : 'info'}>
								{variants.filter((variant) => variant.ready).length} ready
							</Pill>
						</div>
					</div>
					<div className="experiments-actions">
						<Button onClick={() => this.props.pageView.generate()} disabled={processing}>Generate {faceKey} Range</Button>
						<Button onClick={() => this.props.pageView.load({ force: true })} disabled={processing}>Reload</Button>
					</div>
				</header>
				{processing && this.state.processingLabel ? this.renderBusy() : null}
				{variants.length ? this.renderVariants(variants, faceKey) : this.renderEmpty()}
				{this.state.resultDialog ? this.renderResultDialog(this.state.resultDialog) : null}
				{messageDialog ? this.renderMessageDialog(messageDialog) : null}
			</section>
		);
	}

	renderVariants(variants, faceKey) {
		return (
			<section className="experiments-grid" aria-label={`${faceKey} cutter simplification variants`}>
				{variants.map((variant) => (
					<article className="experiments-card" key={variant.id}>
						<header>
							<strong>{variant.label}</strong>
							<small>{variant.ready ? 'ready' : 'not generated'}</small>
						</header>
						<div className="experiments-preview">
							{variant.artifacts?.previewPng ? (
								<button
									type="button"
									className="experiments-preview-button"
									onClick={() => this.openResultDialog(variant, 'inlay')}
									aria-label={`Open ${variant.label} ${faceKey} result`}
								>
									<img src={this.assetUrl(variant.artifacts.previewPng)} alt={`${variant.label} ${faceKey} tile preview`} />
								</button>
							) : (
								<div className="experiments-preview-missing">No preview</div>
							)}
						</div>
						{variant.stats ? this.renderStats(variant.stats) : null}
						<footer>
							{this.renderResultButton('Preview', variant, 'preview')}
							{this.renderResultButton('SVG', variant, 'svg')}
							{this.renderResultButton('Cutter', variant, 'cutter')}
							{this.renderResultButton('Inlay', variant, 'inlay')}
						</footer>
					</article>
				))}
			</section>
		);
	}

	renderStats(stats) {
		return (
			<dl className="experiments-stats">
				<div>
					<dt>commands</dt>
					<dd>{stats.commands}</dd>
				</div>
				<div>
					<dt>segments</dt>
					<dd>{stats.lineSegments}</dd>
				</div>
				<div>
					<dt>bytes</dt>
					<dd>{stats.bytes}</dd>
				</div>
			</dl>
		);
	}

	renderResultButton(label, variant, resultType) {
		if (!this.resultArtifactPath(variant, resultType)) {
			return null;
		}

		return (
			<button type="button" onClick={() => this.openResultDialog(variant, resultType)}>
				{label}
			</button>
		);
	}

	renderEmpty() {
		return <div className="experiments-empty">No experiment variants are available.</div>;
	}

	renderBusy() {
		return (
			<div className="pipeline-busy-overlay" role="status" aria-live="polite">
				<div className="pipeline-busy">
					<div className="pipeline-spinner" />
					<span>{this.state.processingLabel}</span>
				</div>
			</div>
		);
	}

	renderMessageDialog(messageDialog) {
		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog" role="dialog" aria-modal="true" aria-labelledby="experiments-dialog-title">
					<header>
						<h2 id="experiments-dialog-title">{messageDialog.title}</h2>
					</header>
					<p>{messageDialog.message}</p>
					<footer>
						<span />
						<Button variant="primary" onClick={() => this.props.pageView.dismissMessageDialog()}>OK</Button>
					</footer>
				</section>
			</div>
		);
	}

	renderResultDialog(resultDialog) {
		const { variant, resultType } = resultDialog;
		const title = `${variant.label} ${this.resultLabel(resultType)}`;

		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog experiments-result-dialog" role="dialog" aria-modal="true" aria-labelledby="experiments-result-title">
					<header>
						<h2 id="experiments-result-title">{title}</h2>
					</header>
					{this.renderResultBody(variant, resultType)}
					<footer>
						{variant.stats ? this.renderStats(variant.stats) : <span />}
						<Button variant="primary" onClick={() => this.closeResultDialog()}>Close</Button>
					</footer>
				</section>
			</div>
		);
	}

	renderResultBody(variant, resultType) {
		const path = this.resultArtifactPath(variant, resultType);
		if (!path) {
			return <div className="experiments-preview-missing">No result</div>;
		}

		if (resultType === 'cutter' || resultType === 'inlay') {
			return (
				<div className="experiments-result-glb">
					<AssetGlbPreview glbUrl={this.assetUrl(path)} label={`${variant.label} ${this.resultLabel(resultType)}`} />
				</div>
			);
		}

		return (
			<div className="experiments-result-image">
				<img src={this.assetUrl(path)} alt={`${variant.label} ${this.resultLabel(resultType)}`} />
			</div>
		);
	}

	openResultDialog(variant, resultType) {
		if (!this.resultArtifactPath(variant, resultType)) {
			return;
		}
		this.setState({ resultDialog: { variant, resultType } });
	}

	closeResultDialog() {
		this.setState({ resultDialog: null });
	}

	resultArtifactPath(variant, resultType) {
		const artifacts = variant?.artifacts || {};
		if (resultType === 'preview') {
			return artifacts.previewPng;
		}
		if (resultType === 'svg') {
			return artifacts.simplifiedSvg;
		}
		if (resultType === 'cutter') {
			return artifacts.cutterModel;
		}
		if (resultType === 'inlay') {
			return artifacts.inlayModel;
		}
		return '';
	}

	resultLabel(resultType) {
		if (resultType === 'preview') {
			return 'Preview';
		}
		if (resultType === 'svg') {
			return 'Simplified SVG';
		}
		if (resultType === 'cutter') {
			return 'Cutter Model';
		}
		if (resultType === 'inlay') {
			return 'Inlay Model';
		}
		return 'Result';
	}

	assetUrl(path) {
		return this.props.pageView.assetUrl(path);
	}
}
