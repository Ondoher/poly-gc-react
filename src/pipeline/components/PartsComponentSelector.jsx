import React from 'react';
import Button from './Button.jsx';

export function partSelection(selectedPartId, part) {
	const samePart = selectedPartId === part.id;

	return {
		partId: samePart ? '' : part.id,
		componentIds: samePart ? [] : [...(part.componentIds || [])],
		componentSelectionExplicit: false,
	};
}

export function componentSelection(selection, component) {
	const selectedPartId = selection?.partId || '';
	const selectedComponentIds = selection?.componentIds || [];
	const componentPartId = (component.partIds || [])[0] || '';
	const nextPartId = componentPartId && componentPartId !== selectedPartId
		? componentPartId
		: selectedPartId;
	const componentIds = componentPartId && componentPartId !== selectedPartId
		? []
		: selectedComponentIds;
	const nextComponentIds = componentIds.includes(component.id)
		? componentIds.filter((componentId) => componentId !== component.id)
		: [...componentIds, component.id];

	return {
		partId: nextPartId,
		componentIds: nextComponentIds,
		componentSelectionExplicit: true,
	};
}

export default class PartsComponentSelector extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			detailsOpen: props.defaultDetailsOpen === true,
		};
	}

	componentDidMount() {
		if (this.props.isFocused && !this.state.detailsOpen) {
			this.setState({ detailsOpen: true });
		}
	}

	componentDidUpdate(previousProps) {
		const focusChanged = !previousProps.isFocused && this.props.isFocused;
		const focusedSelectionChanged = this.props.isFocused && (
			previousProps.selectedPartLabel !== this.props.selectedPartLabel
			|| previousProps.selectedComponentCount !== this.props.selectedComponentCount
		);

		if ((focusChanged || focusedSelectionChanged) && !this.state.detailsOpen) {
			this.setState({ detailsOpen: true });
		}
	}

	selectedComponentIds() {
		return this.props.selectedComponentIds || [];
	}

	emitSelection(selection, details) {
		if (this.props.onSelectionChange) {
			this.props.onSelectionChange(selection, details);
		}
	}

	partSelection(part) {
		return partSelection(this.props.selectedPartId || '', part);
	}

	componentSelection(component) {
		return componentSelection({
			partId: this.props.selectedPartId || '',
			componentIds: this.selectedComponentIds(),
		}, component);
	}

	selectPart(part) {
		this.emitSelection(this.partSelection(part), {
			part,
			source: 'part',
		});
		part.onSelect?.();
	}

	selectComponent(component) {
		this.emitSelection(this.componentSelection(component), {
			component,
			source: 'component',
		});
		component.onSelect?.();
	}

	renderTitle() {
		const {
			faceTitle,
			faceSubtitle,
			statusLabel,
		} = this.props;

		return (
			<div className="face-title">
				<strong>{faceTitle}</strong>
				<span title={faceSubtitle}>{faceSubtitle}</span>
				{statusLabel ? <em>{statusLabel}</em> : null}
			</div>
		);
	}

	renderPartRow(part) {
		return (
			<div
				className={[
					'structure-part',
					part.selected ? 'selected-structure-part' : '',
					part.bound ? 'bound-structure-part' : '',
					part.highlight ? 'highlight-unbound-structure-part' : '',
					part.className || '',
				].filter(Boolean).join(' ')}
				key={part.id}
				data-review-part={part.reviewKey}
				style={part.style || null}
				title={part.title || ''}
			>
				<button
					type="button"
					className={part.rowButtonClassName || 'structure-row-main'}
					onClick={() => this.selectPart(part)}
				>
					<strong>{part.label}</strong>
				</button>
				{part.afterLabel || null}
				<em>{part.status}</em>
				{part.clearLabel ? (
					<Button
						className="structure-row-clear optional-part-clear"
						onClick={(event) => {
							event.stopPropagation();
							part.onClear?.();
						}}
					>
						{part.clearLabel}
					</Button>
				) : null}
			</div>
		);
	}

	renderComponentRow(component) {
		return (
			<div
				className={[
					'structure-component-row',
					component.selected ? 'selected-structure-component' : '',
					component.bound ? 'bound-structure-component' : '',
					component.highlight ? 'highlight-unbound-structure-component' : '',
					component.className || '',
				].filter(Boolean).join(' ')}
				key={component.id}
				data-review-component={component.reviewKey}
				style={component.style || null}
				title={component.title || ''}
			>
				<button
					type="button"
					className={component.rowButtonClassName || 'structure-row-main'}
					onClick={() => this.selectComponent(component)}
				>
					<strong>{component.label}</strong>
				</button>
				{component.afterLabel || null}
				{component.meta ? <span className={component.metaClassName || ''}>{component.meta}</span> : null}
				<em>{component.status}</em>
			</div>
		);
	}

	renderPartList() {
		const {
			partsTitle = 'Parts',
			parts = [],
			emptyPartsMessage = 'No parts found.',
			partListClassName = 'structure-list-panel',
		} = this.props;

		return (
			<section className={partListClassName}>
				<div className="structure-section-label">{partsTitle}</div>
				<div className="structure-parts">
					{parts.length ? parts.map((part) => this.renderPartRow(part)) : (
						<div className="optional-muted-row">{emptyPartsMessage}</div>
					)}
				</div>
			</section>
		);
	}

	renderComponentList() {
		const {
			componentsTitle = 'Components',
			components = [],
			emptyComponentsMessage = 'No components found.',
			componentListClassName = 'structure-list-panel component-list-panel',
		} = this.props;

		return (
			<section className={componentListClassName}>
				<div className="structure-section-label">{componentsTitle}</div>
				<div className="structure-components">
					{components.length ? components.map((component) => this.renderComponentRow(component)) : (
						<div className="optional-muted-row">{emptyComponentsMessage}</div>
					)}
				</div>
			</section>
		);
	}

	renderLists() {
		return (
			<React.Fragment>
				{this.renderPartList()}
				{this.props.showComponents === false ? null : this.renderComponentList()}
			</React.Fragment>
		);
	}

	renderActions() {
		const {
			actionsLabel = 'Parts To Components',
			selectedPartLabel = 'Select part',
			selectedComponentCount = 0,
			canBind = false,
			selectedPartHasBinding = false,
			canUnbind = selectedPartHasBinding,
			onBind,
			onUnbind,
		} = this.props;

		return (
			<section className="structure-selector-actions">
				<div className="structure-section-label">{actionsLabel}</div>
				<div className="structure-bind-actions">
					<Button onClick={onBind} disabled={!canBind}>Bind</Button>
					{selectedPartHasBinding ? (
						<Button onClick={onUnbind} disabled={!canUnbind}>Unbind</Button>
					) : null}
					<span>{selectedPartLabel} / {selectedComponentCount} selected</span>
				</div>
			</section>
		);
	}

	renderBody() {
		const {
			showActions = true,
			bodyExtra = null,
		} = this.props;

		return (
			<div className="structure-card-body">
				{this.renderTitle()}
				{showActions ? this.renderActions() : null}
				{bodyExtra}
			</div>
		);
	}

	renderDetails() {
		const {
			detailClassName = 'structure-lists',
		} = this.props;
		const { detailsOpen } = this.state;

		return (
			<div className={detailClassName}>
				<div className="structure-list-header">
					<Button
						className="structure-list-toggle"
						aria-expanded={detailsOpen}
						onClick={() => this.setState({ detailsOpen: !detailsOpen })}
					>
						{detailsOpen ? 'Close' : 'Open'}
					</Button>
				</div>
				{detailsOpen ? this.renderLists() : null}
			</div>
		);
	}

	render() {
		return (
			<div className="structure-selector">
				{this.renderBody()}
				{this.renderDetails()}
			</div>
		);
	}
}
