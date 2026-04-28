import React from "react";
import { Button, Pill, ViewSelector } from "../../../components/index.js";
import RenderingOptionsModel from "../models/RenderingOptionsModel.js";

const SUIT_LABELS = {
	bamboo: "Bamboos",
	character: "Characters",
	dot: "Dots",
	wind: "Winds",
	flower: "Flowers",
	season: "Seasons",
	dragon: "Dragons",
	other: "Other",
};
const RENDER_MODE_LABELS = {
	"source-preferred": "Source Preferred",
	generated: "Generated",
	omit: "Omit",
};

export function FinalRenderingOptionsHeaderSummary({ finalRenderingOptions }) {
	const summary = finalRenderingOptions?.summary;

	if (!summary) {
		return (
			<div className="structure-header-summary final-rendering-header-summary">
				<Pill>No render data loaded</Pill>
			</div>
		);
	}

	return (
		<div className="structure-header-summary final-rendering-header-summary">
			<Pill>{summary.faceCount || 0} faces</Pill>
			<Pill>{summary.readyCount || 0} ready</Pill>
			<Pill reportLevel={(summary.unresolvedRenderCount || 0) > 0 ? "warning" : "info"}>
				{summary.unresolvedRenderCount || 0} unresolved
			</Pill>
		</div>
	);
}

export default class FinalRenderingOptionsPage extends React.Component {
	constructor(props) {
		super(props);
		const pageState = props.pageView.getState();

		this.state = {
			...pageState,
			options: new RenderingOptionsModel(pageState.finalRenderingOptions).initialOptions(),
			viewMode: "preview",
		};
	}

	componentDidMount() {
		this.updateListener = this.props.pageView.listen("updated", (pageState) => {
			this.setState({
				...pageState,
				options: new RenderingOptionsModel(pageState.finalRenderingOptions).initialOptions(),
				viewMode: this.state.viewMode || "preview",
			});
		});
		this.props.pageView.load({ quiet: true });
	}

	componentWillUnmount() {
		this.props.pageView.unlisten("updated", this.updateListener);
	}

	updateSuitPart = (suitId, partId, renderMode) => {
		this.setState((state) => ({
			options: {
				...state.options,
				suits: {
					...(state.options.suits || {}),
					[suitId]: RenderingOptionsModel.updateOptionGroupPart(state.options.suits?.[suitId], { suitId }, partId, renderMode),
				},
			},
		}));
	};

	updateFacePart = (face, partId, renderMode) => {
		this.setState((state) => {
			const facesOptions = { ...(state.options.faces || {}) };

			if (renderMode === "inherit") {
				const nextGroup = RenderingOptionsModel.removeOptionGroupPart(facesOptions[face.faceKey], partId);
				if (RenderingOptionsModel.hasFaceOverrides(nextGroup)) {
					facesOptions[face.faceKey] = nextGroup;
				} else {
					delete facesOptions[face.faceKey];
				}
			} else {
				facesOptions[face.faceKey] = RenderingOptionsModel.updateOptionGroupPart(
					facesOptions[face.faceKey],
					{ faceKey: face.faceKey, suitId: face.family },
					partId,
					renderMode,
				);
			}

			return {
				options: {
					...state.options,
					faces: facesOptions,
				},
			};
		});
	};

	updateFaceArtworkReflectX = (face, reflectX) => {
		this.setState((state) => {
			const facesOptions = { ...(state.options.faces || {}) };
			const nextGroup = RenderingOptionsModel.updateFaceArtworkReflectX(
				facesOptions[face.faceKey],
				{ faceKey: face.faceKey, suitId: face.family },
				reflectX,
			);

			if (RenderingOptionsModel.hasFaceOverrides(nextGroup)) {
				facesOptions[face.faceKey] = nextGroup;
			} else {
				delete facesOptions[face.faceKey];
			}

			return {
				options: {
					...state.options,
					faces: facesOptions,
				},
			};
		});
	};

	updateFaceArtworkPreserveColors = (face, preserveColors) => {
		this.setState((state) => {
			const facesOptions = { ...(state.options.faces || {}) };
			const nextGroup = RenderingOptionsModel.updateFaceArtworkPreserveColors(
				facesOptions[face.faceKey],
				{ faceKey: face.faceKey, suitId: face.family },
				preserveColors,
			);

			if (RenderingOptionsModel.hasFaceOverrides(nextGroup)) {
				facesOptions[face.faceKey] = nextGroup;
			} else {
				delete facesOptions[face.faceKey];
			}

			return {
				options: {
					...state.options,
					faces: facesOptions,
				},
			};
		});
	};

	setViewMode(viewMode) {
		this.setState({ viewMode });
	}

	renderSuitOptions(faces) {
		const groupedFaces = new RenderingOptionsModel().groupFacesByFamily(faces);
		const { options } = this.state;

		return (
			<section className="final-rendering-suit-options" aria-label="Suit rendering options">
				{Object.entries(groupedFaces).map(([family, familyFaces]) => (
					<SuitOptionsCard
						key={family}
						family={family}
						faceCount={familyFaces.length}
						options={options.suits?.[family]}
						onPartChange={(partId, renderMode) => this.updateSuitPart(family, partId, renderMode)}
					/>
				))}
			</section>
		);
	}

	renderFaceGrid(faces) {
		const { options } = this.state;

		return (
			<section className="final-rendering-face-grid">
				{faces.map((face) => (
					<FinalRenderingFaceCard
						key={face.faceKey}
						face={face}
						suitOptions={options.suits?.[face.family]}
						faceOptions={options.faces?.[face.faceKey]}
						onPartChange={(partId, renderMode) => this.updateFacePart(face, partId, renderMode)}
						onArtworkReflectXChange={(reflectX) => this.updateFaceArtworkReflectX(face, reflectX)}
						onArtworkPreserveColorsChange={(preserveColors) => this.updateFaceArtworkPreserveColors(face, preserveColors)}
						viewMode={this.state.viewMode}
						assetUrl={(path) => this.props.pageView.assetUrl(path)}
						referenceImageUrl={(faceKey) => this.props.pageView.referenceImageUrl(faceKey)}
					/>
				))}
			</section>
		);
	}

	render() {
		const { finalRenderingOptions, processing, messageDialog } = this.state;

		return (
			<section className="final-rendering-options-page">
				{this.renderHeader()}
				<div className="final-rendering-options-content">
					{finalRenderingOptions?.faces ? this.renderContent() : this.renderEmptyState()}
				</div>
				{processing ? this.renderBusy() : null}
				{messageDialog ? this.renderMessageDialog(messageDialog) : null}
			</section>
		);
	}

	renderHeaderActions() {
		const { finalRenderingOptions, options, processing } = this.state;
		const hasRenderData = Boolean(finalRenderingOptions?.faces);

		return (
			<div className="final-rendering-options-actions">
				<Button onClick={() => this.props.pageView.load({ force: true })} disabled={processing}>Reload</Button>
				<Button
					variant="primary"
					onClick={() => this.props.pageView.rerender(options)}
					disabled={processing || !hasRenderData}
				>
					Rerender
				</Button>
				<Button
					variant="accept"
					onClick={() => this.props.pageView.accept(options)}
					disabled={processing || !hasRenderData}
				>
					Accept
				</Button>
			</div>
		);
	}

	renderHeader() {
		return (
			<header className="final-rendering-options-header">
				<div className="final-rendering-options-title">
					<h1>Render Review</h1>
					<ViewSelector
						ariaLabel="Render review view"
						value={this.state.viewMode}
						options={[
							{ value: "preview", label: "Preview" },
							{ value: "source", label: "Source" },
							{ value: "reference", label: "Reference" },
							{ value: "overlay", label: "Overlay" },
							{ value: "invert", label: "Invert" },
						]}
						onChange={(viewMode) => this.setViewMode(viewMode)}
					/>
					<FinalRenderingOptionsHeaderSummary finalRenderingOptions={this.state.finalRenderingOptions} />
				</div>
				{this.renderHeaderActions()}
			</header>
		);
	}

	renderContent() {
		const { finalRenderingOptions } = this.state;

		const faces = new RenderingOptionsModel(finalRenderingOptions).faces();

		return (
			<React.Fragment>
				{this.renderSuitOptions(faces)}
				{this.renderFaceGrid(faces)}
			</React.Fragment>
		);
	}

	renderEmptyState() {
		return <div className="empty-state">No final rendering data is available. Accept source assignment before reviewing the first render.</div>;
	}

	renderBusy() {
		return (
			<div className="pipeline-busy-overlay" role="status" aria-live="polite">
				<div className="pipeline-busy">
					<div className="pipeline-spinner" />
					<span>{this.state.processingLabel || "Working..."}</span>
				</div>
			</div>
		);
	}

	renderMessageDialog(messageDialog) {
		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog" role="dialog" aria-modal="true" aria-labelledby="final-rendering-dialog-title">
					<header>
						<h2 id="final-rendering-dialog-title">{messageDialog.title}</h2>
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
}

class SuitOptionsCard extends React.Component {
	render() {
		const { family, faceCount, options, onPartChange } = this.props;

		return (
			<article className="final-rendering-suit-card">
				<div className="final-rendering-card-title">
					<strong>{SUIT_LABELS[family] || family}</strong>
					<span>{faceCount} faces</span>
				</div>
				<div className="final-rendering-option-rows">
					{RenderingOptionsModel.optionPartIdsForFamily(family).map((partId) => (
						<RenderModeSelect
							key={partId}
							label={RenderingOptionsModel.partLabel(partId)}
							value={RenderingOptionsModel.renderModeForPart(options?.parts?.[partId])}
							onChange={(renderMode) => onPartChange?.(partId, renderMode)}
						/>
					))}
				</div>
			</article>
		);
	}
}

class FinalRenderingFaceCard extends React.Component {
	renderPreview() {
		const { face, viewMode } = this.props;
		const renderUrl = face.colorSvg ? `${this.assetUrl(face.colorSvg)}&t=${Date.now()}` : "";
		const sourceUrl = face.sourceFile ? this.assetUrl(face.sourceFile) : "";
		const referenceUrl = this.props.referenceImageUrl?.(face.faceKey) || "";

		return (
			<div className={[
				"final-rendering-preview",
				`final-rendering-preview-${viewMode || "preview"}`,
			].filter(Boolean).join(" ")}>
				{viewMode === "source" ? (
					sourceUrl
						? <img className="final-rendering-source-image" src={sourceUrl} alt={`${face.faceKey} source`} />
						: <div className="final-rendering-missing-preview">No source</div>
				) : viewMode === "reference" && referenceUrl ? (
					<img className="final-rendering-reference-image" src={referenceUrl} alt={`${face.faceKey} reference`} />
				) : viewMode === "overlay" && renderUrl && referenceUrl ? (
					<React.Fragment>
						<img className="final-rendering-reference-image" src={referenceUrl} alt={`${face.faceKey} reference`} />
						<img className="final-rendering-render-image final-rendering-transparent-layer" src={renderUrl} alt={`${face.faceKey} final rendered`} />
					</React.Fragment>
				) : viewMode === "invert" && renderUrl && referenceUrl ? (
					<React.Fragment>
						<img className="final-rendering-render-image" src={renderUrl} alt={`${face.faceKey} final rendered`} />
						<img className="final-rendering-reference-image final-rendering-transparent-layer" src={referenceUrl} alt={`${face.faceKey} reference`} />
					</React.Fragment>
				) : renderUrl ? (
					<img className="final-rendering-render-image" src={renderUrl} alt={`${face.faceKey} final rendered`} />
				) : (
					<div className="final-rendering-missing-preview">No render</div>
				)}
			</div>
		);
	}

	renderBody() {
		const { face, suitOptions, faceOptions, onPartChange, onArtworkReflectXChange, onArtworkPreserveColorsChange } = this.props;

		return (
			<div className="final-rendering-face-body">
				<div className="final-rendering-card-title">
					<strong>{face.faceKey}</strong>
					<span>{face.status}</span>
				</div>
				<div className="final-rendering-option-rows">
					{RenderingOptionsModel.optionPartIdsForFamily(face.family).map((partId) => {
						const facePart = faceOptions?.parts?.[partId];
						const inheritedMode = RenderingOptionsModel.renderModeForPart(suitOptions?.parts?.[partId]);

						return (
							<RenderModeSelect
								key={partId}
								label={RenderingOptionsModel.partLabel(partId)}
								value={facePart ? RenderingOptionsModel.renderModeForPart(facePart) : "inherit"}
								inheritedMode={inheritedMode}
								allowInherit
								onChange={(renderMode) => onPartChange?.(partId, renderMode)}
							/>
						);
					})}
					{face.canMirrorArtwork ? (
						<label className="final-rendering-option-row final-rendering-checkbox-row">
							<span>Mirror Artwork</span>
							<input
								type="checkbox"
								checked={Boolean(faceOptions?.transform?.reflectX)}
								onChange={(event) => onArtworkReflectXChange?.(event.target.checked)}
							/>
						</label>
					) : null}
					{face.canPreserveArtworkColors ? (
						<label className="final-rendering-option-row final-rendering-checkbox-row">
							<span>Preserve Artwork Colors</span>
							<input
								type="checkbox"
								checked={Boolean(faceOptions?.artwork?.preserveColors)}
								onChange={(event) => onArtworkPreserveColorsChange?.(event.target.checked)}
							/>
						</label>
					) : null}
				</div>
			</div>
		);
	}

	render() {
		const { face } = this.props;

		return (
			<article className={[
				"final-rendering-face-card",
				face.status !== "ready" ? "needs-review-final-rendering-face" : "",
			].filter(Boolean).join(" ")}>
				{this.renderPreview()}
				{this.renderBody()}
			</article>
		);
	}

	assetUrl(filename) {
		return this.props.assetUrl(filename);
	}
}

class RenderModeSelect extends React.Component {
	render() {
		const { label, value, inheritedMode = "", allowInherit = false, onChange } = this.props;

		return (
			<label className="final-rendering-option-row">
				<span>{label}</span>
				<select value={value} onChange={(event) => onChange?.(event.target.value)}>
					{allowInherit ? <option value="inherit">Suit: {RENDER_MODE_LABELS[inheritedMode] || inheritedMode}</option> : null}
					<option value="source-preferred">Source Preferred</option>
					<option value="generated">Generated</option>
					<option value="omit">Omit</option>
				</select>
			</label>
		);
	}
}
