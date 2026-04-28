import { findSmallIsolatedCandidates, getComponentUnionBounds } from './normalized-face-components.js';

const LABEL_ROLES = new Set([
	'suit-label',
	'wind-label',
	'flower-label',
	'season-label',
]);
const CHARACTER_GLYPH_ROLES = new Set([
	'flower-character',
	'season-character',
]);
const MAIN_ARTWORK_ROLES = new Set([
	'main-artwork',
	'dragon-artwork',
]);
const REPEATED_ARTWORK_ROLES = new Set([
	'dot',
	'bamboo-stick',
	'bamboo-group',
]);

/**
 * Create conservative semantic-part bindings from detected components.
 *
 * The input intentionally uses generic component language so reference PNG
 * components and normalized SVG components can both adapt to this shape.
 *
 * @param {Object} options
 * @param {String} options.faceKey
 * @param {Object} options.face
 * @param {Object} options.parts
 * @param {Array<Object>} options.components
 * @param {Object} [options.assignmentHints]
 * @returns {Object}
 */
export function autoAssignComponentsToSemanticParts({
	faceKey,
	face,
	parts,
	components,
	assignmentHints = {},
}) {
	const partEntries = Object.entries(parts || {});
	const detectedComponents = components.map(normalizeDetectedComponent).filter((component) => component.id && component.bounds);
	const bindings = [];
	const assignedComponentIds = new Set();
	const diagnostics = [];

	const bind = (partId, selectedComponents, strategy, confidence = 'medium') => {
		const availableComponents = selectedComponents
			.filter(Boolean)
			.filter((component) => !assignedComponentIds.has(component.id));

		if (availableComponents.length === 0) {
			return false;
		}

		for (const component of availableComponents) {
			assignedComponentIds.add(component.id);
		}

		bindings.push({
			bindingId: `bind.${faceKey}.${partId}`,
			partId,
			componentIds: availableComponents.map((component) => component.id),
			strategy,
			confidence,
			reviewStatus: 'inferred',
		});

		return true;
	};

	const labelPart = partEntries.find(([, part]) => isLabelPart(part));
	const labelComponent = labelPart
		? selectLabelComponent(detectedComponents, face, labelPart[0], labelPart[1], assignmentHints)
		: null;

	if (labelPart && labelComponent) {
		bind(labelPart[0], [labelComponent], 'auto-label-top-corner', 'medium');
	}

	if (isCharacterSuitFace(face)) {
		bindCharacterSuitParts({ partEntries, components: detectedComponents, assignedComponentIds, bind, diagnostics, face, assignmentHints });
	} else if (isWindFace(face)) {
		bindWindParts({ partEntries, components: detectedComponents, assignedComponentIds, bind, diagnostics });
	} else {
		bindSpecialCharacterPart({ partEntries, components: detectedComponents, assignedComponentIds, bind, face, assignmentHints });
		bindMainArtworkPart({ partEntries, components: detectedComponents, assignedComponentIds, bind });
		bindRepeatedArtworkParts({ partEntries, components: detectedComponents, assignedComponentIds, bind, diagnostics });
	}

	return applyBindings({
		faceKey,
		parts,
		components,
		bindings,
		diagnostics,
		assignmentHints,
	});
}

function bindCharacterSuitParts({ partEntries, components, assignedComponentIds, bind, diagnostics, face, assignmentHints }) {
	const characterPart = partEntries.find(([, part]) => part.role === 'character-body');
	const numberGlyphPart = partEntries.find(([, part]) => part.role === 'character-number-glyph');
	const remaining = unassignedComponents(components, assignedComponentIds);
	const characterHint = resolveAssignmentHint(face, characterPart?.[0], characterPart?.[1], assignmentHints);
	const characterComponent = selectComponentForPart(remaining, components, face, characterPart?.[0], characterPart?.[1], assignmentHints)
		|| largestComponent(remaining);

	if (characterPart && characterComponent) {
		const characterComponents = expandLinkedColorComponents(characterComponent, remaining, components, characterHint);
		const strategy = characterComponents.length > 1
			? 'auto-character-body-hinted-linked-color'
			: 'auto-character-body-hinted-largest';
		bind(characterPart[0], characterComponents, strategy, 'medium');
	}

	if (numberGlyphPart) {
		const hint = resolveAssignmentHint(face, numberGlyphPart[0], numberGlyphPart[1], assignmentHints);
		const glyphComponents = unassignedComponents(components, assignedComponentIds)
			.filter((component) => isComponentInHintRegion(component, components, hint, 'top'))
			.sort(compareByPosition);

		if (glyphComponents.length > 0) {
			bind(numberGlyphPart[0], glyphComponents, 'auto-character-number-glyph-hinted-region', 'medium');
		} else {
			diagnostics.push({
				level: 'info',
				code: 'auto-assignment-unbound-number-glyph',
				message: 'No remaining top components were available for the character number glyph.',
			});
		}
	}
}

function bindWindParts({ partEntries, components, assignedComponentIds, bind, diagnostics }) {
	const characterPart = partEntries.find(([, part]) => part.role === 'wind-character');
	const characterComponents = unassignedComponents(components, assignedComponentIds);

	if (characterPart && characterComponents.length > 0) {
		bind(characterPart[0], characterComponents, 'auto-wind-character-remaining', 'medium');
	} else if (characterPart) {
		diagnostics.push({
			level: 'info',
			code: 'auto-assignment-unbound-wind-character',
			message: 'No remaining components were available for the wind character.',
		});
	}
}

function bindSpecialCharacterPart({ partEntries, components, assignedComponentIds, bind, face, assignmentHints }) {
	const characterPart = partEntries.find(([, part]) => CHARACTER_GLYPH_ROLES.has(part.role));

	if (!characterPart) {
		return;
	}

	const hint = resolveAssignmentHint(face, characterPart[0], characterPart[1], assignmentHints);
	const candidates = smallIsolatedComponents(unassignedComponents(components, assignedComponentIds), components, {
		topBandRatio: 0.42,
		maxAreaRatio: 0.24,
		minWidth: 8,
		minHeight: 8,
	})
		.filter((candidate) => candidate.topBand)
		.filter((candidate) => candidate.normalizedCenter.y < 0.38)
		.sort((left, right) => scoreCandidateAgainstHint(left, hint) - scoreCandidateAgainstHint(right, hint)
			|| left.normalizedCenter.x - right.normalizedCenter.x
			|| right.area - left.area);

	if (candidates[0]?.item) {
		bind(characterPart[0], [candidates[0].item], 'auto-special-character-hinted-isolated', 'low');
	}
}

function bindMainArtworkPart({ partEntries, components, assignedComponentIds, bind }) {
	const mainPart = partEntries.find(([, part]) => isMainArtworkPart(part));

	if (!mainPart) {
		return;
	}

	const mainComponents = unassignedComponents(components, assignedComponentIds);

	if (mainComponents.length > 0) {
		bind(mainPart[0], mainComponents, 'auto-main-artwork-remaining', 'medium');
	}
}

function bindRepeatedArtworkParts({ partEntries, components, assignedComponentIds, bind, diagnostics }) {
	const repeatedParts = partEntries
		.filter(([, part]) => isRepeatedArtworkPart(part))
		.sort(comparePartEntry);

	if (repeatedParts.length === 0) {
		return;
	}

	const repeatedComponents = unassignedComponents(components, assignedComponentIds)
		.sort(compareByPosition);

	if (repeatedComponents.length !== repeatedParts.length) {
		diagnostics.push({
			level: 'info',
			code: 'auto-assignment-repeated-count-mismatch',
			message: `Repeated part count (${repeatedParts.length}) did not match unassigned component count (${repeatedComponents.length}).`,
		});
		return;
	}

	for (const [index, [partId]] of repeatedParts.entries()) {
		bind(partId, [repeatedComponents[index]], 'auto-repeated-position-order', 'low');
	}
}

function applyBindings({ faceKey, parts, components, bindings, diagnostics, assignmentHints }) {
	const bindingByPart = new Map(bindings.map((binding) => [binding.partId, binding]));
	const componentIdsByPart = new Map(bindings.map((binding) => [binding.partId, new Set(binding.componentIds)]));
	const partIdsByComponent = new Map();

	for (const binding of bindings) {
		for (const componentId of binding.componentIds) {
			const partIds = partIdsByComponent.get(componentId) || [];
			partIds.push(binding.partId);
			partIdsByComponent.set(componentId, partIds);
		}
	}

	const nextParts = Object.fromEntries(Object.entries(parts || {}).map(([partId, part]) => {
		const componentIds = [...(componentIdsByPart.get(partId) || [])];

		return [
			partId,
			{
				...part,
				bindingStatus: componentIds.length > 0 ? 'bound' : 'unbound',
				reviewStatus: bindingByPart.has(partId) ? 'inferred' : 'needs-review',
				componentIds,
			},
		];
	}));
	const nextComponents = components.map((component) => {
		const componentId = component.componentId || component.id;
		const partIds = partIdsByComponent.get(componentId) || [];

		return {
			...component,
			bindingStatus: partIds.length > 0 ? 'bound' : 'unbound',
			reviewStatus: partIds.length > 0 ? 'inferred' : 'needs-review',
			partIds,
		};
	});
	const nextPartValues = Object.values(nextParts);
	const allPartsBound = nextPartValues.length > 0 && nextPartValues.every((part) => part.bindingStatus === 'bound');

	return {
		parts: nextParts,
		components: nextComponents,
		bindings: bindings.sort((left, right) => left.partId.localeCompare(right.partId)),
		status: allPartsBound ? 'needs-review-inferred' : 'needs-review',
		autoAssignment: {
			status: allPartsBound ? 'complete-inferred' : 'partial-inferred',
			strategy: 'stage-0-component-auto-assignment',
			bindingCount: bindings.length,
			diagnostics,
			faceKey,
			usesAssignmentHints: Boolean(assignmentHints && Object.keys(assignmentHints).length > 0),
		},
	};
}

function selectLabelComponent(components, face, partId, part, assignmentHints) {
	const expectedColor = expectedLabelColor(face, part);
	const hint = resolveAssignmentHint(face, partId, part, assignmentHints);
	const allCandidates = smallIsolatedComponents(components, components, {
		topBandRatio: 0.42,
		maxAreaRatio: 0.18,
		minWidth: 5,
		minHeight: 8,
	})
		.map((candidate) => ({
			...candidate,
			colorMismatch: expectedColor && candidate.item.dominantColor?.toLowerCase() !== expectedColor.toLowerCase() ? 1 : 0,
			topLabelCandidate: candidate.topBand && candidate.normalizedCenter.y < 0.38,
			positionDistance: scoreCandidateAgainstHint(candidate, hint),
		}));
	const topCandidates = allCandidates.filter((candidate) => candidate.topLabelCandidate);
	const candidates = topCandidates.length > 0 ? topCandidates : allCandidates;

	return candidates
		.sort((left, right) => left.positionDistance - right.positionDistance
			|| left.cornerDistances.topLeft - right.cornerDistances.topLeft
			|| left.colorMismatch - right.colorMismatch
			|| left.normalizedCenter.y - right.normalizedCenter.y
			|| left.area - right.area)[0]?.item || null;
}

function expectedLabelColor(face, part) {
	if (isLabelPart(part)) {
		return '#FC1D05';
	}

	return null;
}

function selectComponentForPart(components, allComponents, face, partId, part, assignmentHints = {}) {
	if (!partId || !part) {
		return null;
	}

	const hint = resolveAssignmentHint(face, partId, part, assignmentHints);
	const candidates = components
		.map((component) => ({
			item: component,
			normalizedCenter: normalizedCenterForComponent(component, allComponents),
		}))
		.filter((candidate) => isComponentInHintRegion(candidate.item, allComponents, hint, null))
		.sort((left, right) => scoreCandidateAgainstHint(left, hint) - scoreCandidateAgainstHint(right, hint)
			|| componentArea(right.item) - componentArea(left.item));

	return candidates[0]?.item || null;
}

function expandLinkedColorComponents(anchorComponent, candidateComponents, allComponents, hint = {}) {
	if (!hint.linkColor || !anchorComponent?.dominantColor) {
		return [anchorComponent].filter(Boolean);
	}

	const anchorColor = anchorComponent.dominantColor.toLowerCase();
	const linkedComponents = candidateComponents
		.filter((component) => component.id === anchorComponent.id
			|| (
				component.dominantColor?.toLowerCase() === anchorColor
				&& isComponentInHintRegion(component, allComponents, hint, null)
			))
		.sort(compareByPosition);

	return linkedComponents.length > 0 ? linkedComponents : [anchorComponent];
}

function resolveAssignmentHint(face, partId, part, assignmentHints = {}) {
	const familyKey = familyHintKey(face?.family);
	const familyHints = assignmentHints.familyPartId || {};
	const familyPartHint = familyHints[`${familyKey}.${partId}`];

	return {
		...(firstMatchingPatternHint(partId, assignmentHints.partPattern) || {}),
		...(assignmentHints.partId?.[partId] || {}),
		...(familyPartHint || {}),
		...(assignmentHints.role?.[part?.role] || {}),
	};
}

function firstMatchingPatternHint(partId, patterns = {}) {
	return Object.entries(patterns)
		.find(([pattern]) => wildcardMatch(pattern, partId))?.[1] || null;
}

function wildcardMatch(pattern, value) {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');

	return new RegExp(`^${escaped}$`).test(value);
}

function familyHintKey(family) {
	return {
		bamboo: 'b',
		characters: 'c',
		dots: 'd',
		winds: 'wind',
		dragons: 'dragon',
		flowers: 'flower',
		seasons: 'season',
	}[family] || family || '';
}

function isComponentInHintRegion(component, allComponents, hint = {}, fallbackRegion = null) {
	const region = hint.region || regionFromPosition(hint.position) || fallbackRegion;

	if (!region) {
		return true;
	}

	const normalizedCenter = normalizedCenterForComponent(component, allComponents);

	if (region === 'top') {
		return normalizedCenter.y < 0.42;
	}

	if (region === 'bottom') {
		return normalizedCenter.y >= 0.42;
	}

	if (region === 'body' || region === 'center') {
		return normalizedCenter.y >= 0.18 && normalizedCenter.y <= 0.86;
	}

	return true;
}

function regionFromPosition(position) {
	if (!position) {
		return null;
	}

	if (position.startsWith('top')) {
		return 'top';
	}

	if (position.startsWith('bottom')) {
		return 'bottom';
	}

	return position === 'center' ? 'center' : null;
}

function scoreCandidateAgainstHint(candidate, hint = {}) {
	const position = hint.position || hint.region || 'top-left';
	const center = candidate.normalizedCenter;

	if (position === 'top-left') {
		return Math.hypot(center.x, center.y);
	}

	if (position === 'top-right') {
		return Math.hypot(1 - center.x, center.y);
	}

	if (position === 'bottom-left') {
		return Math.hypot(center.x, 1 - center.y);
	}

	if (position === 'bottom-right') {
		return Math.hypot(1 - center.x, 1 - center.y);
	}

	if (position === 'top') {
		return center.y;
	}

	if (position === 'bottom') {
		return 1 - center.y;
	}

	if (position === 'body' || position === 'center') {
		return Math.hypot(center.x - 0.5, center.y - 0.5);
	}

	return 0;
}

function normalizedCenterForComponent(component, allComponents) {
	const outerBounds = getComponentUnionBounds(allComponents);

	return {
		x: (component.center.x - outerBounds.left) / Math.max(1, outerBounds.width),
		y: (component.center.y - outerBounds.top) / Math.max(1, outerBounds.height),
	};
}

function smallIsolatedComponents(items, allComponents, options) {
	const outerBounds = getComponentUnionBounds(allComponents.map((component) => component));

	return findSmallIsolatedCandidates(items, outerBounds, options);
}

function normalizeDetectedComponent(component) {
	const bounds = normalizeBounds(component.bounds || component);

	return {
		...component,
		id: component.componentId || component.id,
		bounds,
		center: component.center || centerOf(bounds),
		area: component.area || bounds.width * bounds.height,
	};
}

function normalizeBounds(bounds) {
	if (!bounds) {
		return null;
	}

	const left = bounds.left;
	const top = bounds.top;
	const right = bounds.right ?? (bounds.left + bounds.width);
	const bottom = bounds.bottom ?? (bounds.top + bounds.height);

	if (![left, top, right, bottom].every(Number.isFinite)) {
		return null;
	}

	return {
		left,
		top,
		right,
		bottom,
		width: bounds.width ?? (right - left),
		height: bounds.height ?? (bottom - top),
	};
}

function centerOf(bounds) {
	return {
		x: bounds.left + (bounds.width / 2),
		y: bounds.top + (bounds.height / 2),
	};
}

function unassignedComponents(components, assignedComponentIds) {
	return components.filter((component) => !assignedComponentIds.has(component.id));
}

function largestComponent(components) {
	return [...components]
		.sort((left, right) => componentArea(right) - componentArea(left))[0] || null;
}

function componentArea(component) {
	return component.area || component.bounds.width * component.bounds.height;
}

function isCharacterSuitFace(face) {
	return face.family === 'characters' && Object.values(face.parts || {}).some((part) => part.role === 'character-body');
}

function isWindFace(face) {
	return face.family === 'winds' || Object.values(face.parts || {}).some((part) => part.role === 'wind-character');
}

function isLabelPart(part) {
	return part.contentKind === 'label' || LABEL_ROLES.has(part.role);
}

function isMainArtworkPart(part) {
	return MAIN_ARTWORK_ROLES.has(part.role);
}

function isRepeatedArtworkPart(part) {
	return REPEATED_ARTWORK_ROLES.has(part.role);
}

function comparePartEntry([leftId], [rightId]) {
	return leftId.localeCompare(rightId, undefined, { numeric: true });
}

function compareByPosition(left, right) {
	return left.center.y - right.center.y || left.center.x - right.center.x;
}

