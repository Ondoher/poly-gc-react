import React from "react";
import PreviewGenerator from "../utils/PreviewGenerator.js";

export default class SettingsPreview extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			imageUrl: null,
			canvasSize: null,
			pending: false,
		};

		this.sourceHostRef = React.createRef();
		this.pendingTimer = null;
		this.onRenderComplete = this.onRenderComplete.bind(this);
	}

	componentDidMount() {
		this.ensurePreviewGenerator();
	}

	componentDidUpdate(prevProps) {
		if (
			prevProps.layout !== this.props.layout ||
			prevProps.tileset !== this.props.tileset ||
			prevProps.tilesize !== this.props.tilesize ||
			prevProps.maxTileSize !== this.props.maxTileSize
		) {
			this.syncPreviewGenerator();
		}
	}

	componentWillUnmount() {
		this.clearPendingTimer();
		this.destroyPreviewGenerator();
	}

	ensurePreviewGenerator() {
		if (this.previewGenerator) {
			return;
		}

		var host = this.sourceHostRef.current;
		if (!host) {
			return;
		}

		this.previewGenerator = new PreviewGenerator(host, {
			onRenderComplete: this.onRenderComplete,
		});
		this.syncPreviewGenerator();
	}

	destroyPreviewGenerator() {
		if (!this.previewGenerator) {
			return;
		}

		this.previewGenerator.destroy();
		this.previewGenerator = null;
	}

	syncPreviewGenerator() {
		this.ensurePreviewGenerator();

		if (!this.previewGenerator) {
			return;
		}

		var maxTileSize = this.props.maxTileSize || this.props.tilesize || "tiny";
		var tileSize = this.props.tilesize || maxTileSize;

		this.previewGenerator.setMaxTileSize(maxTileSize);
		this.previewGenerator.setTileSize(tileSize);
		this.previewGenerator.setTileStyle(this.props.tileset);
		this.previewGenerator.setLayout(this.props.layout);
		this.schedulePendingState(!this.state.imageUrl);
		this.previewGenerator.renderNow();
	}

	onRenderComplete(result) {
		this.clearPendingTimer();
		this.setState({
			imageUrl: result.imageUrl,
			canvasSize: result.canvasSize,
			pending: false,
		});
	}

	schedulePendingState(immediate = false) {
		this.clearPendingTimer();

		if (immediate) {
			this.setState({
				pending: true,
			});
			return;
		}

		this.pendingTimer = window.setTimeout(function() {
			this.pendingTimer = null;
			this.setState({
				pending: true,
			});
		}.bind(this), 500);
	}

	clearPendingTimer() {
		if (this.pendingTimer === null) {
			return;
		}

		window.clearTimeout(this.pendingTimer);
		this.pendingTimer = null;
	}

	render() {
		var showPlaceholder = !this.state.imageUrl && !this.state.pending;

		return (
			<>
				<div className="mj-settings-dialog-preview">
					<div className="mj-settings-dialog-preview-surface">
						{this.state.imageUrl ? (
							<img
								className="mj-settings-dialog-preview-image"
								src={this.state.imageUrl}
								alt="Layout preview"
							/>
						) : showPlaceholder ? (
							<div className="mj-settings-dialog-placeholder">
								Layout preview
							</div>
						) : null}
						{this.state.pending ? (
							<div className="mj-settings-dialog-preview-loading" aria-live="polite">
								<div className="mj-settings-dialog-preview-spinner" aria-hidden="true"></div>
								<div className="mj-settings-dialog-preview-loading-label">
									Rendering preview
								</div>
							</div>
						) : null}
					</div>
				</div>
				<div
					ref={this.sourceHostRef}
					className="mj-settings-dialog-preview-source-host"
					aria-hidden="true"
				></div>
			</>
		);
	}
}
