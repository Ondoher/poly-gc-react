export default class OptionalComponentAssignments {
	constructor(assignments = {}) {
		this.assignments = assignments || {};
	}

	value() {
		return this.assignments;
	}

	assignedPartFor(componentId) {
		return OptionalComponentAssignments.assignedPartFor(this.assignments, componentId);
	}

	assign(partId, componentIds) {
		return new OptionalComponentAssignments(
			OptionalComponentAssignments.assign(this.assignments, partId, componentIds),
		);
	}

	unassign(partId, componentIds = null) {
		return new OptionalComponentAssignments(
			OptionalComponentAssignments.unassign(this.assignments, partId, componentIds),
		);
	}

	prune(parts) {
		return new OptionalComponentAssignments(
			OptionalComponentAssignments.prune(this.assignments, parts),
		);
	}

	sortComponentsForReview(components, parts) {
		const partOrder = new Map(parts.map((part, index) => [part.partId, index]));
		const originalOrder = new Map(components.map((component, index) => [component.componentId, index]));

		return [...components].sort((left, right) => {
			const leftPartOrder = this.componentSemanticOrder(left, partOrder);
			const rightPartOrder = this.componentSemanticOrder(right, partOrder);

			if (leftPartOrder !== rightPartOrder) {
				return leftPartOrder - rightPartOrder;
			}

			return (originalOrder.get(left.componentId) ?? 0) - (originalOrder.get(right.componentId) ?? 0);
		});
	}

	componentSemanticOrder(component, partOrder) {
		const assignedPartId = this.assignedPartFor(component.componentId);
		const order = partOrder.get(assignedPartId);

		return Number.isFinite(order) ? order : Number.POSITIVE_INFINITY;
	}

	static initial(parts) {
		return Object.fromEntries(parts.map((part) => [
			part.partId,
			[...(part.suggestedComponentIds || [])],
		]));
	}

	static prune(assignments, parts) {
		const partIds = new Set(parts.map((part) => part.partId));

		return Object.fromEntries(Object.entries(assignments || {})
			.filter(([partId]) => partIds.has(partId)));
	}

	static assign(assignments, partId, componentIds) {
		const selectedComponentIds = new Set(componentIds);
		const nextAssignments = {};

		for (const [candidatePartId, candidateComponentIds] of Object.entries(assignments || {})) {
			nextAssignments[candidatePartId] = candidatePartId === partId
				? [...componentIds]
				: (candidateComponentIds || []).filter((componentId) => !selectedComponentIds.has(componentId));
		}

		if (!nextAssignments[partId]) {
			nextAssignments[partId] = [...componentIds];
		}

		return nextAssignments;
	}

	static unassign(assignments, partId, componentIds = null) {
		const selectedComponentIds = Array.isArray(componentIds) ? new Set(componentIds) : null;
		const currentComponentIds = assignments?.[partId] || [];

		return {
			...(assignments || {}),
			[partId]: selectedComponentIds
				? currentComponentIds.filter((componentId) => !selectedComponentIds.has(componentId))
				: [],
		};
	}

	static assignedPartFor(assignments, componentId) {
		return Object.entries(assignments || {}).find(([, componentIds]) => (
			(componentIds || []).includes(componentId)
		))?.[0] || '';
	}

	static partLabel(partId) {
		if (partId === 'label') {
			return 'Label';
		}

		if (partId === 'glyph') {
			return 'Character glyph';
		}

		return partId || 'Optional part';
	}
}
