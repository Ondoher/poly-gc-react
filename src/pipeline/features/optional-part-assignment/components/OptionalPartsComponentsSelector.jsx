import React from 'react';
import { PartsComponentSelector } from '../../../components/index.js';
import OptionalComponentAssignments from '../models/OptionalComponentAssignments.js';

export default class OptionalPartsComponentsSelector extends React.Component {
	optionalPartRow(part) {
		const {
			face,
			selectedPartId,
			componentAssignments,
			onClearAssignment,
		} = this.props;
		const topCandidate = part.candidates?.[0] || null;
		const activeComponentIds = componentAssignments[part.partId] || [];
		const componentCount = activeComponentIds.length;
		const status = componentCount ? `${componentCount} comp${componentCount === 1 ? '' : 's'}` : 'unbound';

		return {
			id: part.partId,
			componentIds: activeComponentIds,
			label: OptionalComponentAssignments.partLabel(part.partId),
			status,
			selected: selectedPartId === part.partId,
			bound: Boolean(componentCount),
			reviewKey: `${face.faceKey}:${part.partId}`,
			rowButtonClassName: 'structure-row-main optional-row-main',
			className: [
				'optional-part-row',
				`optional-part-row-${part.partId}`,
				componentCount ? 'bound-optional-part-row' : '',
				selectedPartId === part.partId ? 'selected-optional-part-row' : '',
			].filter(Boolean).join(' '),
			title: [
				OptionalComponentAssignments.partLabel(part.partId),
				part.role || part.contentKind,
				part.hint?.region,
				activeComponentIds.length ? activeComponentIds.join(', ') : '',
				topCandidate ? `${Math.round((topCandidate.score || 0) * 100)}% ${(topCandidate.reasons || []).join(', ')}` : '',
			].filter(Boolean).join(' / '),
			clearLabel: activeComponentIds.length ? 'clear' : '',
			onClear: () => onClearAssignment?.(part.partId),
		};
	}

	optionalComponentRow(component) {
		const {
			face,
			componentAssignments,
			selectedComponentIds,
			highlightedComponentIds,
		} = this.props;
		const assignedPartId = new OptionalComponentAssignments(componentAssignments).assignedPartFor(component.componentId);
		const isSelected = selectedComponentIds.includes(component.componentId);
		const isSuggested = highlightedComponentIds.has(component.componentId);
		const componentIndex = (face.components || []).indexOf(component);

		return {
			id: component.componentId,
			partIds: assignedPartId ? [assignedPartId] : [],
			label: assignedPartId ? OptionalComponentAssignments.partLabel(assignedPartId) : `Component ${componentIndex + 1}`,
			status: assignedPartId ? 'bound' : 'unbound',
			meta: component.componentId,
			metaClassName: 'optional-component-id',
			selected: isSelected,
			bound: Boolean(assignedPartId),
			reviewKey: `${face.faceKey}:${component.componentId}`,
			rowButtonClassName: 'structure-row-main optional-row-main',
			className: [
				'optional-component-row',
				assignedPartId ? `optional-component-row-${assignedPartId}` : '',
				assignedPartId ? 'bound-optional-component-row' : '',
				isSelected ? 'selected-optional-component-row' : '',
				isSuggested ? 'suggested-optional-component-row' : '',
			].filter(Boolean).join(' '),
			title: [
				component.componentId,
				component.sourceElementId,
				assignedPartId ? OptionalComponentAssignments.partLabel(assignedPartId) : '',
				component.className || component.fill || component.stroke || 'paint',
			].filter(Boolean).join(' / '),
		};
	}

	render() {
		const {
			face,
			parts,
			selectedPartId,
			selectedComponentIds,
			componentAssignments,
			canAssign,
			bodyExtra = null,
			onAssignSelection,
			onClearAssignment,
			onSelectionChange,
		} = this.props;
		const foundCount = parts.filter((part) => part.sourceState === 'candidate-found').length;
		const hasEnabledParts = parts.length > 0;
		const selectedPartBinding = componentAssignments[selectedPartId] || [];
		const selectedBoundComponentIds = selectedComponentIds.filter((componentId) => selectedPartBinding.includes(componentId));
		const sortedComponents = new OptionalComponentAssignments(componentAssignments)
			.sortComponentsForReview(face.components || [], parts);

		return (
			<PartsComponentSelector
				faceTitle={face.faceKey}
				faceSubtitle={`${foundCount}/${parts.length} found / ${face.componentCount || face.components?.length || 0} components`}
				statusLabel={face.status === 'needs-review' ? 'Review' : ''}
				isFocused={Boolean(selectedPartId || selectedComponentIds.length)}
				showActions={hasEnabledParts}
				showComponents
				selectedPartId={selectedPartId}
				selectedComponentIds={selectedComponentIds}
				selectedPartLabel={selectedPartId ? OptionalComponentAssignments.partLabel(selectedPartId) : 'Select part'}
				selectedComponentCount={selectedComponentIds.length}
				canBind={hasEnabledParts && canAssign}
				canUnbind={Boolean(selectedPartBinding.length)}
				selectedPartHasBinding={Boolean(selectedPartBinding.length)}
				onBind={onAssignSelection}
				onUnbind={() => onClearAssignment?.(
					selectedPartId,
					selectedBoundComponentIds.length ? selectedBoundComponentIds : null,
				)}
				onSelectionChange={(selection, details) => onSelectionChange?.(selection, details)}
				partsTitle="Optional Parts"
				componentsTitle="Normalized Components"
				detailClassName="optional-face-detail"
				partListClassName="optional-part-list"
				componentListClassName="optional-part-list optional-component-list"
				emptyPartsMessage="No label or glyph parts are enabled in the bulk settings."
				emptyComponentsMessage="No normalized components found."
				bodyExtra={bodyExtra}
				parts={parts.map((part) => this.optionalPartRow(part))}
				components={sortedComponents.map((component) => this.optionalComponentRow(component))}
			/>
		);
	}
}
