import React from 'react';
import {
	BoundsBox,
	Button,
	PartsComponentSelector,
	Pill,
	ViewSelector,
	componentSelectorSelection,
	partSelectorSelection,
} from '../../../components/index.js';
import PipelinePresentationModel from '../models/PipelinePresentationModel.js';
import RenderingGeometryModel from '../models/RenderingGeometryModel.js';
import SemanticReviewModel from '../models/SemanticReviewModel.js';

const STRUCTURE_PART_COLORS = [
	"#006d77",
	"#c1121f",
	"#386641",
	"#5a189a",
	"#bc6c25",
	"#1d4ed8",
	"#9d174d",
	"#007f5f",
	"#6d597a",
	"#b08900",
	"#3a86ff",
	"#d00000",
];

export default class SourceAssignmentPage extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			...props.pageView.getState(),
			viewMode: 'all',
		};
	}

	componentDidMount() {
		this.updateListener = this.props.pageView.listen('updated', (state) => this.setState(state));
		this.props.pageView.load({ quiet: true });
	}

	componentWillUnmount() {
		this.props.pageView.unlisten('updated', this.updateListener);
	}

	sourceFaces() {
		return SemanticReviewModel.sourceAssignmentFaces({
			sourceAcceptance: this.state.sourceAcceptance,
			referenceStructure: this.state.referenceStructure,
			sourceSemanticBindings: this.state.sourceSemanticBindings,
			sourceSemanticPartStates: this.state.sourceSemanticPartStates,
		});
	}

	setViewMode(viewMode) {
		this.setState({ viewMode });
	}

	onSelectionChange(faceKey, selection, details = {}) {
		if (details.source === 'component') {
			this.setState({ viewMode: 'all' });
		}

		this.props.pageView.setSelection(faceKey, selection);
	}

	renderHeader() {
		const { sourceAcceptance, processing, dirty, viewMode } = this.state;

		return (
			<header className="source-assignment-header">
				<div className="source-assignment-title">
					<h1>Source Assignment</h1>
					<ViewSelector
						ariaLabel="Source assignment view"
						value={viewMode}
						options={[
							{ value: 'all', label: 'All' },
							{ value: 'parts', label: 'Parts' },
							{ value: 'unbound', label: 'Unbound' },
						]}
						onChange={(nextViewMode) => this.setViewMode(nextViewMode)}
					/>
					<SourceAssignmentHeaderSummary
						summary={this.state.summary}
						onShowFirstUnboundPart={() => this.props.pageView.showFirstUnboundPart()}
						onShowFirstUnboundComponent={() => this.props.pageView.showFirstUnboundComponent()}
					/>
				</div>
				<div className="source-assignment-actions">
					<Button onClick={() => this.props.pageView.load({ force: true })} disabled={processing}>Reload</Button>
					<Button variant="primary" onClick={() => this.props.pageView.save()} disabled={processing || !sourceAcceptance}>Save</Button>
					<Button variant="accept" onClick={() => this.props.pageView.accept()} disabled={processing || !sourceAcceptance}>Accept</Button>
				</div>
			</header>
		);
	}

	renderGrid(faces) {
		return (
			<section className="structure-grid">
				{faces.map((face) => (
					<SourceAssignmentCard
						key={face.faceKey}
						face={face}
						selection={this.state.selection}
						onSelectionChange={(faceKey, selection, details) => this.onSelectionChange(faceKey, selection, details)}
						onBind={(faceKey) => this.props.pageView.bindSelection(faceKey)}
						onUnbind={(faceKey, partId, componentIds) => this.props.pageView.unbindPart(faceKey, partId, componentIds)}
						viewMode={this.state.viewMode}
						highlightUnboundComponents={this.state.highlightUnboundComponents}
						highlightUnboundParts={this.state.highlightUnboundParts}
						assetUrl={(path) => this.props.pageView.assetUrl(path)}
					/>
				))}
			</section>
		);
	}

	render() {
		return (
			<section className="source-assignment-page">
				{this.renderHeader()}
				<div className="source-assignment-content">
					{this.renderContent()}
				</div>
				{this.state.processing ? this.renderBusy() : null}
				{this.state.messageDialog ? this.renderMessageDialog(this.state.messageDialog) : null}
			</section>
		);
	}

	renderContent() {
		if (!this.state.sourceAcceptance?.faces) {
			return <div className="empty-state">No source normalization data is available. Run source normalization before reviewing this page.</div>;
		}

		if (!this.state.referenceStructure?.faces) {
			return <div className="empty-state">No reference structure is loaded. Source approval needs approved reference semantic parts.</div>;
		}

		return this.renderGrid(this.sourceFaces());
	}

	renderBusy() {
		return (
			<div className="pipeline-busy-overlay">
				<div>{this.state.processingLabel || 'Working...'}</div>
			</div>
		);
	}

	renderMessageDialog(messageDialog) {
		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog" role="dialog" aria-modal="true" aria-labelledby="source-assignment-message-title">
					<header>
						<h2 id="source-assignment-message-title">{messageDialog.title}</h2>
					</header>
					<p>{messageDialog.message}</p>
					<footer>
						<Button onClick={() => this.props.pageView.dismissMessageDialog()}>OK</Button>
					</footer>
				</section>
			</div>
		);
	}
}

export function SourceAssignmentHeaderSummary({
	summary,
	onShowFirstUnboundPart,
	onShowFirstUnboundComponent,
}) {
	return (
		<div className="structure-header-summary" aria-label="Source assignment summary">
			<Pill>{summary?.faceCount || 0} faces</Pill>
			<Pill>{summary?.partCount || 0} source parts</Pill>
			<Pill>{summary?.bindingCount || 0} bindings</Pill>
			<Pill
				reportLevel={(summary?.unboundPartCount || 0) > 0 ? 'warning' : 'info'}
				onClick={onShowFirstUnboundPart}
				disabled={(summary?.unboundPartCount || 0) === 0}
			>
				{summary?.unboundPartCount || 0} unbound parts
			</Pill>
			<Pill
				onClick={onShowFirstUnboundComponent}
				disabled={(summary?.unboundComponentCount || 0) === 0}
			>
				{summary?.unboundComponentCount || 0} unassigned components
			</Pill>
		</div>
	);
}

class SourceAssignmentCard extends React.Component {
	cardContext() {
		const { face, selection } = this.props;
		const partEntries = Object.entries(face.parts || {});
		const components = face.components || [];
		const sourceComponents = face.sourceComponents || components;
		const selectedPartId = selection?.faceKey === face.faceKey ? selection.partId : "";
		const selectedComponentIds = selection?.faceKey === face.faceKey ? selection.componentIds : [];
		const bindings = face.bindings || [];

		return {
			partEntries,
			components,
			sourceComponents,
			selectedPartId,
			selectedComponentIds,
			componentSelectionExplicit: Boolean(selection?.faceKey === face.faceKey && selection.componentSelectionExplicit),
			isFocusedFace: selection?.faceKey === face.faceKey,
			canBind: Boolean(selectedPartId && selectedComponentIds.length > 0),
			selectedPartBinding: bindings.find((binding) => binding.partId === selectedPartId),
			canUnbind: selectedComponentIds.length > 0,
			allPartsBound: partEntries.length > 0 && partEntries.every(([, part]) => SemanticReviewModel.sourcePartSatisfied(part)),
			partColors: Object.fromEntries(partEntries.map(([partId], index) => [
				partId,
				STRUCTURE_PART_COLORS[index % STRUCTURE_PART_COLORS.length],
			])),
		};
	}

	renderPreview(context) {
		const { face, onSelectionChange, viewMode, highlightUnboundComponents, assetUrl } = this.props;
		const previewPath = face.identifiedComponentsSvg || face.sourceFile;
		const showPartBoxes = viewMode === 'parts';
		const showUnbound = viewMode === 'unbound';

		return (
			<div className="structure-card-preview">
				<div
					className={[
						"face-preview",
						showPartBoxes || showUnbound ? "source-part-box-preview" : "",
						showUnbound ? "source-unbound-preview" : "",
					].filter(Boolean).join(" ")}
					style={{ aspectRatio: `${face.canvas.width} / ${face.canvas.height}` }}
				>
					{viewMode === 'all' && previewPath ? <img src={assetUrl(previewPath)} alt={face.faceKey} /> : null}
					{showPartBoxes || showUnbound ? this.renderSourceFaceComponents(context, { dimBoundParts: showUnbound }) : null}
					{showPartBoxes ? this.sourcePartBoxes(context).map((partBox) => {
						const selected = context.selectedPartId === partBox.partId;
						const dimmed = Boolean(context.selectedPartId && !selected);

						return (
							<BoundsBox
								key={partBox.partId}
								bounds={partBox.bounds}
								canvas={face.canvas}
								className={[
									"source-part-bounds",
									selected ? "selected-source-part-bounds" : "",
									dimmed ? "dimmed-source-part-bounds" : "",
									!partBox.bound ? "unbound-source-part-bounds" : "",
								].filter(Boolean).join(" ")}
								style={this.structurePartColorStyle(partBox.color, 0.08)}
								title={partBox.title}
								onClick={() => onSelectionChange?.(face.faceKey, partSelectorSelection(context.selectedPartId, {
									id: partBox.partId,
									componentIds: face.parts?.[partBox.partId]?.componentIds || [],
								}))}
							/>
						);
					}) : context.components.map((component, index) => {
						const componentPartId = component.partIds?.[0] || "";
						const isPendingSelected = context.selectedComponentIds.includes(component.componentId);
						const isSelectedPartComponent = Boolean(context.selectedPartId && component.partIds?.includes(context.selectedPartId));
						const isEditingSelectedPart = Boolean(isSelectedPartComponent && context.componentSelectionExplicit);
						const isSelected = isPendingSelected || (isSelectedPartComponent && !isEditingSelectedPart);
						const isUnbound = (component.partIds || []).length === 0;
						const isDimmedBound = showUnbound && !isUnbound;
						const componentColor = context.partColors[componentPartId] || (isPendingSelected ? context.partColors[context.selectedPartId] : "");

						return (
							<BoundsBox
								key={component.componentId || index}
								bounds={component.bounds}
								canvas={face.canvas}
								className={[
									"reference-component",
									"source-component",
									isSelected ? "selected-reference-component" : "",
									component.bindingStatus === "bound" ? "bound-reference-component" : "",
									isDimmedBound ? "dimmed-bound-source-component" : "",
									highlightUnboundComponents && isUnbound ? "highlight-unbound-reference-component" : "",
								].filter(Boolean).join(" ")}
								style={this.structurePartColorStyle(componentColor)}
								title={[
									component.componentId,
									componentPartId,
									component.fill || component.stroke,
									`${component.bounds?.width || 0}x${component.bounds?.height || 0}`,
								].filter(Boolean).join(" / ")}
								onClick={() => onSelectionChange?.(face.faceKey, componentSelectorSelection({
									partId: context.selectedPartId,
									componentIds: context.selectedComponentIds,
								}, {
									id: component.componentId,
									partIds: component.partIds || [],
								}))}
							/>
						);
					})}
				</div>
			</div>
		);
	}

	renderSourceFaceComponents(context, { dimBoundParts = false } = {}) {
		const { face } = this.props;
		const selectedPartId = context.selectedPartId;
		const artworkBounds = RenderingGeometryModel.unionBounds(context.sourceComponents
			.filter((component) => !component.classification?.tileLayerCandidate)
			.map((component) => component.bounds));
		const selectedPartBounds = selectedPartId
			? RenderingGeometryModel.unionBounds(context.components
				.filter((component) => component.partIds?.includes(selectedPartId))
				.map((component) => component.bounds))
			: null;
		const sortedComponents = RenderingGeometryModel.sortComponentsForPaintOrder(context.sourceComponents)
			.filter((component) => this.isFaceArtworkPreviewComponent(component, artworkBounds))
			.filter((component) => component.pathData);

		return (
			<svg
				className="source-face-components-svg"
				viewBox={`${face.canvas.left} ${face.canvas.top} ${face.canvas.width} ${face.canvas.height}`}
				aria-hidden="true"
			>
				{sortedComponents.map((component) => {
					const componentPartIds = component.partIds || [];
					const selected = Boolean(selectedPartId && (
						componentPartIds.includes(selectedPartId)
						|| (component.classification?.negativeSpaceCandidate && RenderingGeometryModel.boundsOverlap(component.bounds, selectedPartBounds))
					));
					const dimmed = Boolean((selectedPartId && !selected) || (dimBoundParts && componentPartIds.length > 0));
					const fill = PipelinePresentationModel.normalizeHexColor(component.fill) || component.fill;
					const stroke = PipelinePresentationModel.normalizeHexColor(component.stroke) || component.stroke;

					return (
						<path
							key={component.componentId}
							className={[
								"source-face-component-path",
								selected ? "selected-source-face-component-path" : "",
								dimmed ? "dimmed-source-face-component-path" : "",
							].filter(Boolean).join(" ")}
							d={component.pathData}
							transform={RenderingGeometryModel.componentTransformString(component)}
							fill={fill && fill !== "none" ? fill : "none"}
							stroke={stroke && stroke !== "none" ? stroke : "none"}
							strokeWidth={component.strokeWidth || undefined}
							fillRule={component.fillRule || undefined}
							clipRule={component.clipRule || undefined}
						/>
					);
				})}
			</svg>
		);
	}

	isFaceArtworkPreviewComponent(component, artworkBounds) {
		if (!component.classification?.tileLayerCandidate) {
			return true;
		}

		if (!component.classification?.negativeSpaceCandidate || !artworkBounds) {
			return false;
		}

		return RenderingGeometryModel.boundsOverlap(component.bounds, artworkBounds)
			&& component.area / Math.max(1, RenderingGeometryModel.boundsArea(artworkBounds)) <= 0.9;
	}

	sourcePartBoxes(context) {
		return context.partEntries
			.map(([partId, part]) => {
				const componentIds = new Set(part.componentIds || []);
				const components = context.components.filter((component) => componentIds.has(component.componentId));
				const bounds = this.unionBounds(components.map((component) => component.bounds));

				if (!bounds) {
					return null;
				}

				return {
					partId,
					bounds,
					color: context.partColors[partId],
					bound: SemanticReviewModel.sourcePartSatisfied(part),
					title: [
						SemanticReviewModel.referencePartLabel(partId, part),
						`${components.length} component${components.length === 1 ? "" : "s"}`,
					].join(" / "),
				};
			})
			.filter(Boolean);
	}

	renderSelector(context) {
		const { face, onSelectionChange, onBind, onUnbind, highlightUnboundComponents, highlightUnboundParts } = this.props;
		const sortedComponents = SemanticReviewModel.sortComponentsForReview(context.components, context.partEntries);

		return (
			<PartsComponentSelector
				faceTitle={face.faceKey}
				faceSubtitle={`${context.partEntries.length} parts / ${context.components.length} components`}
				statusLabel={context.allPartsBound ? "Complete" : ""}
				isFocused={context.isFocusedFace}
				actionsLabel="Source Assignment"
				selectedPartId={context.selectedPartId}
				selectedComponentIds={context.selectedComponentIds}
				selectedPartLabel={context.selectedPartId || "Select part"}
				selectedComponentCount={context.selectedComponentIds.length}
				canBind={context.canBind}
				canUnbind={context.canUnbind}
				selectedPartHasBinding={context.canUnbind || Boolean(context.selectedPartBinding)}
				onBind={() => onBind(face.faceKey)}
				onUnbind={() => onUnbind?.(face.faceKey, context.selectedPartId, context.selectedComponentIds)}
				onSelectionChange={(selection, details) => onSelectionChange?.(face.faceKey, selection, details)}
				partsTitle="Source Parts"
				componentsTitle="Normalized Components"
				parts={context.partEntries.map(([partId, part]) => this.sourcePartRow({
					face,
					partId,
					part,
					selectedPartId: context.selectedPartId,
					partColors: context.partColors,
					highlightUnboundParts,
				}))}
				components={sortedComponents.map((component) => this.sourceComponentRow({
					face,
					component,
					components: context.components,
					selectedPartId: context.selectedPartId,
					selectedComponentIds: context.selectedComponentIds,
					componentSelectionExplicit: context.componentSelectionExplicit,
					partColors: context.partColors,
					highlightUnboundComponents,
				}))}
			/>
		);
	}

	render() {
		const { face } = this.props;
		const context = this.cardContext();

		return (
			<article className={[
				"structure-card",
				"source-assignment-card",
				context.isFocusedFace ? "focused-structure-card" : "",
				context.allPartsBound ? "complete-structure-card" : "",
			].filter(Boolean).join(" ")} data-review-face={face.faceKey}>
				{this.renderPreview(context)}
				{this.renderSelector(context)}
			</article>
		);
	}

	sourcePartRow({ face, partId, part, selectedPartId, partColors, highlightUnboundParts }) {
		const componentCount = part.componentIds?.length || 0;
		const empty = part.allowEmpty === true && componentCount === 0;
		const isUnbound = !SemanticReviewModel.sourcePartSatisfied(part);

		return {
			id: partId,
			label: SemanticReviewModel.referencePartLabel(partId, part),
			status: part.bindingStatus === "bound"
				? `${componentCount} comp${componentCount === 1 ? "" : "s"}`
				: part.reviewStatus === "accepted" ? "accepted" : empty ? "empty" : "no binding",
			selected: selectedPartId === partId,
			bound: part.bindingStatus === "bound",
			highlight: highlightUnboundParts && isUnbound,
			reviewKey: `${face.faceKey}:${partId}`,
			componentIds: part.componentIds || [],
			style: this.structurePartColorStyle(partColors[partId]),
		};
	}

	sourceComponentRow({ face, component, components, selectedPartId, selectedComponentIds, componentSelectionExplicit, partColors, highlightUnboundComponents }) {
		const componentPartId = component.partIds?.[0] || "";
		const componentPart = componentPartId ? face.parts?.[componentPartId] : null;
		const isPendingSelected = selectedComponentIds.includes(component.componentId);
		const isSelectedPartComponent = Boolean(selectedPartId && component.partIds?.includes(selectedPartId));
		const isEditingSelectedPart = Boolean(isSelectedPartComponent && componentSelectionExplicit);
		const isUnbound = (component.partIds || []).length === 0;
		const componentColor = partColors[componentPartId] || (isPendingSelected ? partColors[selectedPartId] : "");
		const componentIndex = components.indexOf(component) + 1;

		return {
			id: component.componentId,
			partIds: component.partIds || [],
			label: componentPartId ? SemanticReviewModel.referencePartLabel(componentPartId, componentPart) : `Component ${componentIndex}`,
			status: component.bindingStatus === "bound" ? "bound" : "unbound",
			selected: isPendingSelected || (isSelectedPartComponent && !isEditingSelectedPart),
			bound: component.bindingStatus === "bound",
			highlight: highlightUnboundComponents && isUnbound,
			reviewKey: `${face.faceKey}:${component.componentId}`,
			style: this.structurePartColorStyle(componentColor),
			title: [
				component.componentId,
				componentPartId,
				component.fill || component.stroke,
			].filter(Boolean).join(" / "),
			meta: component.componentId,
			metaClassName: "structure-source-component-id",
		};
	}

	structurePartColorStyle(color, backgroundAlpha = 0.13) {
		if (!color) {
			return null;
		}

		return {
			"--structure-part-color": color,
			"--structure-part-bg": PipelinePresentationModel.hexToRgba(color, backgroundAlpha),
			"--structure-part-shadow": PipelinePresentationModel.hexToRgba(color, 0.35),
		};
	}

	unionBounds(boundsList) {
		const validBounds = boundsList.filter((bounds) => bounds
			&& Number.isFinite(bounds.left)
			&& Number.isFinite(bounds.top)
			&& Number.isFinite(bounds.right)
			&& Number.isFinite(bounds.bottom));

		if (validBounds.length === 0) {
			return null;
		}

		const left = Math.min(...validBounds.map((bounds) => bounds.left));
		const top = Math.min(...validBounds.map((bounds) => bounds.top));
		const right = Math.max(...validBounds.map((bounds) => bounds.right));
		const bottom = Math.max(...validBounds.map((bounds) => bounds.bottom));

		return {
			left,
			top,
			right,
			bottom,
			width: right - left,
			height: bottom - top,
		};
	}
}

export function makeSourceSemanticFace({ faceKey, sourceFace, referenceFace, bindings, partStates }) {
	return SemanticReviewModel.makeSourceSemanticFace({ faceKey, sourceFace, referenceFace, bindings, partStates });
}

export function sourceAssignmentReviewSummary(sourceAcceptance, referenceStructure, sourceSemanticBindings, sourceSemanticPartStates) {
	return SemanticReviewModel.sourceAssignmentReviewSummary(sourceAcceptance, referenceStructure, sourceSemanticBindings, sourceSemanticPartStates);
}
