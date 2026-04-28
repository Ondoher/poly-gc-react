import React from 'react';
import {
	BoundsBox,
	Button,
	ColorSwatch,
	PartsComponentSelector,
	Pill,
	componentSelectorSelection,
	partSelectorSelection,
} from '../../../components/index.js';

const STRUCTURE_PART_COLORS = [
	'#006d77',
	'#c1121f',
	'#386641',
	'#5a189a',
	'#bc6c25',
	'#1d4ed8',
	'#9d174d',
	'#007f5f',
	'#6d597a',
	'#b08900',
	'#3a86ff',
	'#d00000',
];

export default class ReferenceApprovalPage extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			...props.pageView.getState(),
			partBoxMode: false,
		};
	}

	componentDidMount() {
		this.updateListener = this.props.pageView.listen('updated', (state) => {
			this.setState(state);
		});
		this.props.pageView.load({ quiet: true });
	}

	componentWillUnmount() {
		this.props.pageView.unlisten('updated', this.updateListener);
	}

	togglePartBoxMode() {
		this.setState((state) => ({
			partBoxMode: !state.partBoxMode,
		}));
	}

	onSelectionChange(faceKey, selection, details = {}) {
		if (details.source === 'component') {
			this.setState({ partBoxMode: false });
		}

		this.props.pageView.setSelection(faceKey, selection);
	}

	render() {
		const { structure, processing, messageDialog } = this.state;

		return (
			<section className="reference-approval-page">
				{this.renderHeader()}
				<div className="reference-approval-content">
					{structure?.faces ? this.renderGrid() : this.renderEmptyState()}
				</div>
				{processing ? this.renderBusy() : null}
				{messageDialog ? this.renderMessageDialog(messageDialog) : null}
			</section>
		);
	}

	renderHeader() {
		const { pageView } = this.props;
		const { structure, selection, summary, dirty, processing, partBoxMode } = this.state;

		return (
			<header className="reference-approval-header">
				<div className="reference-approval-title">
					<h1>Reference Approval</h1>
					<ReferenceStructureHeaderSummary
						summary={summary}
						onAddPaletteColor={(color) => pageView.addPaletteColor(color)}
						onShowFirstIncompleteFace={() => pageView.showFirstIncompleteFace()}
						onShowFirstUnboundPart={() => pageView.showFirstUnboundPart()}
						onShowFirstUnboundComponent={() => pageView.showFirstUnboundComponent()}
					/>
				</div>
				<div className="reference-approval-actions">
					<Button active={partBoxMode} onClick={() => this.togglePartBoxMode()}>Part Boxes</Button>
					<Button onClick={() => pageView.load({ force: true })} disabled={processing}>Reload</Button>
					<Button variant="primary" onClick={() => pageView.saveDraft()} disabled={processing || !structure || !dirty}>Save Draft</Button>
					<Button variant="accept" onClick={() => pageView.accept()} disabled={processing || !structure}>Accept</Button>
				</div>
			</header>
		);
	}

	renderGrid() {
		const { structure } = this.state;
		const faces = Object.entries(structure.faces || {});
		const paletteColorSet = this.props.pageView.paletteColorSet(structure.referenceSet?.palette);

		return (
			<section className="structure-grid">
				{faces.map(([faceKey, face]) => (
					<ReferenceStructureCard
						key={faceKey}
						faceKey={faceKey}
						face={face}
						selection={this.state.selection}
						pageView={this.props.pageView}
						onSelectionChange={(nextFaceKey, selection, details) => this.onSelectionChange(nextFaceKey, selection, details)}
						onBind={(nextFaceKey) => this.props.pageView.bindSelection(nextFaceKey)}
						onUnbind={(nextFaceKey, partId, componentIds) => this.props.pageView.unbindPart(nextFaceKey, partId, componentIds)}
						onAddPaletteColor={(color) => this.props.pageView.addPaletteColor(color)}
						paletteColorSet={paletteColorSet}
						partBoxMode={this.state.partBoxMode}
						highlightUnboundComponents={this.state.highlightUnboundComponents}
						highlightUnboundParts={this.state.highlightUnboundParts}
					/>
				))}
			</section>
		);
	}

	renderEmptyState() {
		return (
			<div className="empty-state">
				No reference structure is available. Run the reference setup step before approving Stage 0.
			</div>
		);
	}

	renderBusy() {
		return (
			<div className="pipeline-busy-overlay" role="status" aria-live="polite">
				<div className="pipeline-busy">
					<div className="pipeline-spinner" />
					<span>{this.state.processingLabel || 'Working...'}</span>
				</div>
			</div>
		);
	}

	renderMessageDialog(messageDialog) {
		return (
			<div className="pipeline-dialog-overlay" role="presentation">
				<section className="pipeline-dialog" role="dialog" aria-modal="true" aria-labelledby="reference-approval-dialog-title">
					<header>
						<h2 id="reference-approval-dialog-title">{messageDialog.title}</h2>
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

class ReferenceStructureCard extends React.Component {
	cardContext() {
		const { faceKey, face, selection } = this.props;
		const partEntries = Object.entries(face.parts || {});
		const components = face.components || [];
		const selectedPartId = selection?.faceKey === faceKey ? selection.partId : '';
		const selectedComponentIds = selection?.faceKey === faceKey ? selection.componentIds : [];
		const componentSelectionExplicit = Boolean(selection?.faceKey === faceKey && selection.componentSelectionExplicit);
		const bindings = face.bindings || [];
		const selectedPartBinding = bindings.find((binding) => binding.partId === selectedPartId);
		const selectedBoundComponentIds = selectedPartBinding?.componentIds || [];

		return {
			partEntries,
			components,
			selectedPartId,
			selectedComponentIds,
			componentSelectionExplicit,
			isFocusedFace: selection?.faceKey === faceKey,
			canBind: Boolean(selectedPartId && selectedComponentIds.length > 0),
			selectedPartBinding,
			canUnbind: Boolean(
				selectedPartBinding
				&& componentSelectionExplicit
				&& selectedComponentIds.some((componentId) => selectedBoundComponentIds.includes(componentId)),
			),
			allPartsBound: partEntries.length > 0 && partEntries.every(([, part]) => part.bindingStatus === 'bound'),
			partColors: Object.fromEntries(partEntries.map(([partId], index) => [
				partId,
				STRUCTURE_PART_COLORS[index % STRUCTURE_PART_COLORS.length],
			])),
		};
	}

	render() {
		const { faceKey, face } = this.props;
		const canvas = {
			left: 0,
			top: 0,
			width: face.image?.width || 164,
			height: face.image?.height || 238,
		};
		const context = this.cardContext();

		return (
			<article className={[
				'structure-card',
				context.isFocusedFace ? 'focused-structure-card' : '',
				context.allPartsBound ? 'complete-structure-card' : '',
			].filter(Boolean).join(' ')} data-review-face={faceKey}>
				{this.renderPreview(canvas, context)}
				{this.renderSelector(context)}
			</article>
		);
	}

	renderPreview(canvas, context) {
		const { faceKey, face, pageView, partBoxMode, onSelectionChange, highlightUnboundComponents } = this.props;
		const { components, selectedPartId, selectedComponentIds, componentSelectionExplicit, partColors } = context;

		return (
			<div className="structure-card-preview">
				<div
					className={[
						'face-preview',
						partBoxMode ? 'reference-part-box-preview' : '',
					].filter(Boolean).join(' ')}
					style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
				>
					{face.sourceFile ? <img src={pageView.assetUrl(face.sourceFile)} alt={faceKey} /> : null}
					{partBoxMode ? this.referencePartBoxes(context).map((partBox) => {
						const selected = selectedPartId === partBox.partId;
						const dimmed = Boolean(selectedPartId && !selected);

						return (
							<BoundsBox
								key={partBox.partId}
								bounds={partBox.bounds}
								canvas={canvas}
								className={[
									'reference-part-bounds',
									selected ? 'selected-reference-part-bounds' : '',
									dimmed ? 'dimmed-reference-part-bounds' : '',
								].filter(Boolean).join(' ')}
								style={structurePartColorStyle(partBox.color)}
								title={partBox.title}
								onClick={() => onSelectionChange?.(faceKey, partSelectorSelection(selectedPartId, {
									id: partBox.partId,
									componentIds: partBox.componentIds,
								}))}
							/>
						);
					}) : components.map((component, index) => {
						const componentPartId = component.partIds?.[0] || '';
						const isPendingSelected = selectedComponentIds.includes(component.componentId);
						const isSelectedPartComponent = Boolean(selectedPartId && component.partIds?.includes(selectedPartId));
						const isEditingSelectedPart = Boolean(isSelectedPartComponent && componentSelectionExplicit);
						const isSelected = isPendingSelected || (isSelectedPartComponent && !isEditingSelectedPart);
						const isUnbound = (component.partIds || []).length === 0;
						const componentColor = partColors[componentPartId] || (isPendingSelected ? partColors[selectedPartId] : '');

						return (
							<BoundsBox
								key={component.componentId || index}
								bounds={component.bounds}
								canvas={canvas}
								className={[
									'reference-component',
									isSelected ? 'selected-reference-component' : '',
									component.bindingStatus === 'bound' ? 'bound-reference-component' : '',
									highlightUnboundComponents && isUnbound ? 'highlight-unbound-reference-component' : '',
								].filter(Boolean).join(' ')}
								style={structurePartColorStyle(componentColor)}
								title={[
									component.componentId,
									componentPartId,
									component.dominantColor,
									`${component.bounds?.width || 0}x${component.bounds?.height || 0}`,
								].filter(Boolean).join(' / ')}
								onClick={() => onSelectionChange?.(faceKey, componentSelectorSelection({
									partId: selectedPartId,
									componentIds: selectedComponentIds,
								}, {
									id: component.componentId,
									partIds: [...(component.partIds || [])],
								}))}
							/>
						);
					})}
				</div>
			</div>
		);
	}

	referencePartBoxes(context) {
		const { pageView } = this.props;

		return context.partEntries
			.map(([partId, part]) => {
				const componentIds = new Set(part.componentIds || []);
				const components = context.components.filter((component) => componentIds.has(component.componentId));
				const bounds = unionBounds(components.map((component) => component.bounds));

				if (!bounds) {
					return null;
				}

				return {
					partId,
					bounds,
					componentIds: [...componentIds],
					color: context.partColors[partId],
					title: [
						pageView.partLabel(partId, part),
						`${components.length} component${components.length === 1 ? '' : 's'}`,
					].join(' / '),
				};
			})
			.filter(Boolean);
	}

	renderSelector(context) {
		const {
			faceKey,
			face,
			pageView,
			onSelectionChange,
			onBind,
			onUnbind,
			onAddPaletteColor,
			paletteColorSet,
			highlightUnboundComponents,
			highlightUnboundParts,
		} = this.props;
		const sortedComponents = pageView.sortComponentsForReview(context.components, context.partEntries);

		return (
			<PartsComponentSelector
				faceTitle={faceKey}
				faceSubtitle={`${context.partEntries.length} parts / ${context.components.length} components`}
				statusLabel={context.allPartsBound ? 'Complete' : ''}
				isFocused={context.isFocusedFace}
				actionsLabel="Reference Binding"
				selectedPartLabel={context.selectedPartId || 'Select part'}
				selectedComponentCount={context.selectedComponentIds.length}
				selectedPartId={context.selectedPartId}
				selectedComponentIds={context.selectedComponentIds}
				componentSelectionExplicit={context.componentSelectionExplicit}
				canBind={context.canBind}
				canUnbind={context.canUnbind}
				selectedPartHasBinding={Boolean(context.selectedPartBinding)}
				onSelectionChange={(selection, details) => onSelectionChange?.(faceKey, selection, details)}
				onBind={() => onBind(faceKey)}
				onUnbind={() => onUnbind?.(faceKey, context.selectedPartId, context.selectedComponentIds)}
				partsTitle="Semantic Parts"
				componentsTitle="Detected Components"
				parts={context.partEntries.map(([partId, part]) => this.referencePartRow({
					faceKey,
					partId,
					part,
					selectedPartId: context.selectedPartId,
					partColors: context.partColors,
					paletteColorSet,
					highlightUnboundParts,
					onAddPaletteColor,
				}))}
				components={sortedComponents.map((component) => this.referenceComponentRow({
					faceKey,
					face,
					component,
					components: context.components,
					selectedPartId: context.selectedPartId,
					selectedComponentIds: context.selectedComponentIds,
					componentSelectionExplicit: context.componentSelectionExplicit,
					partColors: context.partColors,
					paletteColorSet,
					highlightUnboundComponents,
					onAddPaletteColor,
				}))}
			/>
		);
	}

	referencePartRow({ faceKey, partId, part, selectedPartId, partColors, paletteColorSet, highlightUnboundParts, onAddPaletteColor }) {
		const { pageView } = this.props;
		const componentCount = part.componentIds?.length || 0;
		const colorSwatch = pageView.referenceColorSwatch(part, paletteColorSet);
		const isUnbound = (part.componentIds || []).length === 0;

		return {
			id: partId,
			componentIds: [...(part.componentIds || [])],
			label: pageView.partLabel(partId, part),
			status: part.bindingStatus === 'bound' ? `${componentCount} comp${componentCount === 1 ? '' : 's'}` : 'unbound',
			selected: selectedPartId === partId,
			bound: part.bindingStatus === 'bound',
			highlight: highlightUnboundParts && isUnbound,
			reviewKey: `${faceKey}:${partId}`,
			style: structurePartColorStyle(partColors[partId]),
			afterLabel: (
				<ColorSwatch
					className="structure-palette-swatch"
					color={colorSwatch.color}
					known={colorSwatch.known}
					addable={Boolean(colorSwatch.color && !colorSwatch.known)}
					title={colorSwatch.known ? colorSwatch.title : `${colorSwatch.title}. Add to palette.`}
					onClick={colorSwatch.color && !colorSwatch.known ? () => onAddPaletteColor?.(colorSwatch.color) : null}
					disabled={!colorSwatch.color || colorSwatch.known}
				/>
			),
		};
	}

	referenceComponentRow({ faceKey, face, component, components, selectedPartId, selectedComponentIds, componentSelectionExplicit, partColors, paletteColorSet, highlightUnboundComponents, onAddPaletteColor }) {
		const { pageView } = this.props;
		const componentPartId = component.partIds?.[0] || '';
		const componentPart = componentPartId ? face.parts?.[componentPartId] : null;
		const isPendingSelected = selectedComponentIds.includes(component.componentId);
		const isSelectedPartComponent = Boolean(selectedPartId && component.partIds?.includes(selectedPartId));
		const isEditingSelectedPart = Boolean(isSelectedPartComponent && componentSelectionExplicit);
		const isUnbound = (component.partIds || []).length === 0;
		const componentColor = partColors[componentPartId] || (isPendingSelected ? partColors[selectedPartId] : '');
		const componentIndex = components.indexOf(component) + 1;
		const colorSwatch = pageView.referenceColorSwatch(component, paletteColorSet);

		return {
			id: component.componentId,
			partIds: [...(component.partIds || [])],
			label: componentPartId ? pageView.partLabel(componentPartId, componentPart) : `Component ${componentIndex}`,
			status: component.bindingStatus === 'bound' ? 'bound' : 'unbound',
			selected: isPendingSelected || (isSelectedPartComponent && !isEditingSelectedPart),
			bound: component.bindingStatus === 'bound',
			highlight: highlightUnboundComponents && isUnbound,
			reviewKey: `${faceKey}:${component.componentId}`,
			style: structurePartColorStyle(componentColor),
			title: [
				component.componentId,
				componentPartId,
				component.dominantColor,
				`${component.pixels} px`,
			].filter(Boolean).join(' / '),
			afterLabel: (
				<ColorSwatch
					className="structure-palette-swatch"
					color={colorSwatch.color}
					known={colorSwatch.known}
					addable={Boolean(colorSwatch.color && !colorSwatch.known)}
					title={colorSwatch.known ? colorSwatch.title : `${colorSwatch.title}. Add to palette.`}
					onClick={colorSwatch.color && !colorSwatch.known ? () => onAddPaletteColor?.(colorSwatch.color) : null}
					disabled={!colorSwatch.color || colorSwatch.known}
				/>
			),
		};
	}
}

function ReferenceStructureHeaderSummary({ summary, onAddPaletteColor, onShowFirstIncompleteFace, onShowFirstUnboundPart, onShowFirstUnboundComponent }) {
	const safeSummary = summary || {
		incompleteFaceCount: 0,
		unboundPartCount: 0,
		unboundComponentCount: 0,
		unknownPaletteColorCount: 0,
		unknownPaletteColors: [],
	};
	const unknownColorSwatches = safeSummary.unknownPaletteColors.length > 0 ? (
		<>
			{safeSummary.unknownPaletteColors.slice(0, 5).map((color) => (
				<ColorSwatch
					key={color}
					className="structure-palette-swatch structure-header-color-swatch"
					color={color}
					known={false}
					addable={true}
					title={`Add ${color} to palette`}
					aria-label={`Add ${color} to palette`}
					onClick={() => onAddPaletteColor?.(color)}
				/>
			))}
			{safeSummary.unknownPaletteColors.length > 5 ? <b aria-label="More unknown colors">...</b> : null}
		</>
	) : null;

	return (
		<div className="structure-header-summary" aria-label="Reference structure review summary">
			<Pill
				reportLevel={safeSummary.incompleteFaceCount > 0 ? 'warning' : 'info'}
				onClick={safeSummary.incompleteFaceCount > 0 ? onShowFirstIncompleteFace : null}
			>
				{safeSummary.incompleteFaceCount} incomplete faces
			</Pill>
			<Pill
				reportLevel={safeSummary.unboundPartCount > 0 ? 'warning' : 'info'}
				onClick={safeSummary.unboundPartCount > 0 ? onShowFirstUnboundPart : null}
			>
				{safeSummary.unboundPartCount} unbound parts
			</Pill>
			<Pill
				reportLevel={safeSummary.unboundComponentCount > 0 ? 'warning' : 'info'}
				onClick={safeSummary.unboundComponentCount > 0 ? onShowFirstUnboundComponent : null}
			>
				{safeSummary.unboundComponentCount} unbound components
			</Pill>
			<Pill
				reportLevel={safeSummary.unknownPaletteColorCount > 0 ? 'warning' : 'info'}
				extraContent={unknownColorSwatches}
			>
				{safeSummary.unknownPaletteColorCount} unknown colors
			</Pill>
		</div>
	);
}

function structurePartColorStyle(color) {
	if (!color) {
		return null;
	}

	return {
		'--structure-part-color': color,
		'--structure-part-bg': hexToRgba(color, 0.12, '36, 82, 71'),
		'--structure-part-bg-strong': hexToRgba(color, 0.2, '36, 82, 71'),
	};
}

function hexToRgba(color, alpha, fallbackRgb) {
	const normalized = String(color || '').replace(/^#/, '');
	const hex = normalized.length === 3
		? normalized.split('').map((digit) => digit + digit).join('')
		: normalized;
	const value = Number.parseInt(hex, 16);

	if (!Number.isFinite(value) || hex.length !== 6) {
		return `rgba(${fallbackRgb}, ${alpha})`;
	}

	return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function unionBounds(boundsList) {
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
