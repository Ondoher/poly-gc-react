import { Service } from '@polylith/core';

const COLOR_WIGGLE_DISTANCE_SQUARED = 2500;

export default class ReferenceApprovalModel extends Service {
	constructor(registry) {
		super('reference-approval-model', registry);
		this.implement([
			'addPaletteColor',
			'bindPart',
			'initialSelection',
			'markAccepted',
			'partLabel',
			'paletteColorSet',
			'referenceColorSwatch',
			'sortComponentsForReview',
			'summary',
			'unbindPart',
		]);
	}

	summary(structure) {
		const faces = Object.values(structure?.faces || {});
		const incompleteFaces = faces.filter((face) => (
			Object.values(face.parts || {}).some((part) => (part.componentIds || []).length === 0)
		));
		const unboundParts = faces.flatMap((face) => (
			Object.values(face.parts || {})
				.filter((part) => (part.componentIds || []).length === 0)
				.map((part) => ({ faceKey: face.faceKey, partId: part.partId }))
		));
		const unboundComponents = faces.flatMap((face) => (
			(face.components || [])
				.filter((component) => (component.partIds || []).length === 0)
				.map((component) => ({ faceKey: face.faceKey, componentId: component.componentId }))
		));
		const paletteColorSet = this.paletteColorSet(structure?.referenceSet?.palette);
		const unknownPaletteColors = this.collectReferenceStructureColors(structure)
			.filter((color) => !paletteColorSet.has(color));

		return {
			faceCount: faces.length,
			incompleteFaceCount: incompleteFaces.length,
			unboundPartCount: unboundParts.length,
			unboundComponentCount: unboundComponents.length,
			unknownPaletteColorCount: unknownPaletteColors.length,
			unknownPaletteColors,
			incompleteFaces: incompleteFaces.map((face) => face.faceKey),
			unboundParts,
			unboundComponents,
		};
	}

	initialSelection(structure) {
		const summary = this.summary(structure);
		const faceKey = summary.incompleteFaces[0] || Object.keys(structure?.faces || {})[0] || '';
		const firstUnboundPart = summary.unboundParts.find((part) => part.faceKey === faceKey);

		return {
			faceKey,
			partId: firstUnboundPart?.partId || '',
			componentIds: [],
			componentSelectionExplicit: false,
		};
	}

	markAccepted(structure, summary) {
		const acceptedOn = new Date().toISOString();
		const accepted = structuredClone(structure);

		accepted.reviewStatus = 'accepted';
		accepted.acceptedOn = acceptedOn;
		accepted.acceptanceSummary = {
			faceCount: summary.faceCount,
			incompleteFaceCount: summary.incompleteFaceCount,
			unboundPartCount: summary.unboundPartCount,
			unboundComponentCount: summary.unboundComponentCount,
			unknownPaletteColorCount: summary.unknownPaletteColorCount,
		};
		accepted.lifecycle = {
			...(accepted.lifecycle || {}),
			reviewStatus: 'accepted',
			acceptedOn,
		};

		for (const face of Object.values(accepted.faces || {})) {
			face.reviewStatus = 'accepted';
			face.acceptedOn = acceptedOn;
		}

		return accepted;
	}

	bindPart(face, partId, componentIds) {
		const binding = {
			bindingId: `bind.${face.faceKey}.${partId}`,
			partId,
			componentIds: [...componentIds],
			strategy: 'manual',
			reviewStatus: 'reviewed',
			updatedOn: new Date().toISOString(),
		};
		const selectedComponentIds = new Set(componentIds);

		face.bindings = [
			...(face.bindings || [])
				.filter((entry) => entry.partId !== partId)
				.map((entry) => ({
					...entry,
					componentIds: (entry.componentIds || []).filter((componentId) => !selectedComponentIds.has(componentId)),
				}))
				.filter((entry) => entry.componentIds.length > 0),
			binding,
		].sort((left, right) => left.partId.localeCompare(right.partId));

		this.refreshBindingState(face);
	}

	unbindPart(face, partId, componentIds = []) {
		const selectedComponentIds = new Set(componentIds || []);

		face.bindings = (face.bindings || [])
			.map((binding) => {
				if (binding.partId !== partId) {
					return binding;
				}

				return {
					...binding,
					componentIds: selectedComponentIds.size > 0
						? (binding.componentIds || []).filter((componentId) => !selectedComponentIds.has(componentId))
						: [],
					updatedOn: new Date().toISOString(),
				};
			})
			.filter((binding) => binding.componentIds.length > 0);

		this.refreshBindingState(face);
	}

	addPaletteColor(structure, color) {
		const normalizedColor = this.normalizeHexColor(color, { uppercase: true });

		if (!normalizedColor || !structure?.referenceSet) {
			return {
				structure,
				componentCount: 0,
				partCount: 0,
				color: normalizedColor,
			};
		}

		const nextStructure = structuredClone(structure);
		const palette = nextStructure.referenceSet.palette || {};
		const paletteColors = palette.colors || [];
		const existing = paletteColors.find((entry) => this.normalizeHexColor(entry.color, { uppercase: true }) === normalizedColor);

		if (existing) {
			delete existing.disabled;
		} else {
			paletteColors.push({ color: normalizedColor });
		}

		nextStructure.referenceSet.palette = {
			...palette,
			colors: paletteColors,
		};

		const applied = this.applyPaletteColorToStructure(nextStructure, normalizedColor);

		return {
			structure: nextStructure,
			color: normalizedColor,
			...applied,
		};
	}

	partLabel(partId, part) {
		if (partId === 'mainArtwork') {
			return 'Artwork';
		}

		if (part?.role === 'character-body') {
			return 'Character Body';
		}

		if (part?.role === 'wind-character') {
			return part?.text ? `Wind ${part.text}` : 'Wind Character';
		}

		if (part?.role === 'wind-label') {
			return part?.text ? `Label ${part.text}` : 'Wind Label';
		}

		if (part?.role === 'character-number-glyph') {
			return part?.text ? `Number Glyph ${part.text}` : 'Number Glyph';
		}

		if (part?.role?.endsWith('-character')) {
			return part?.text ? `Character ${part.text}` : 'Character';
		}

		if (part?.contentKind === 'label' || partId === 'label') {
			return part?.text ? `Label ${part.text}` : 'Label';
		}

		if (part?.role?.includes('number') || partId === 'number') {
			return part?.text ? `Number ${part.text}` : 'Number';
		}

		const ordinalMatch = partId.match(/^(.*)\.(\d+)$/);
		if (ordinalMatch) {
			return `${titleCase(ordinalMatch[1])} ${ordinalMatch[2]}`;
		}

		return titleCase((part?.role || partId).replace(/^suit-/, '').replace(/^main-/, ''));
	}

	sortComponentsForReview(components, partEntries) {
		const partOrder = new Map(partEntries.map(([partId], index) => [partId, index]));
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

	paletteColorSet(palette) {
		return new Set((palette?.colors || [])
			.filter((entry) => entry.disabled !== true)
			.map((entry) => this.normalizeHexColor(entry.color, { uppercase: true }))
			.filter(Boolean));
	}

	referenceColorSwatch(item, paletteColorSet) {
		const paletteColors = item?.paletteColors || [];
		const color = paletteColors.includes(item?.dominantColor)
			? item.dominantColor
			: paletteColors[0] || item?.dominantColor || '';
		const known = Boolean(color && paletteColorSet?.has(this.normalizeHexColor(color, { uppercase: true })));

		return {
			color,
			known,
			title: known
				? `Palette color ${color || 'unknown'}`
				: `Identified color ${color || 'unknown'}; no palette color`,
		};
	}

	refreshBindingState(face) {
		for (const [candidatePartId, part] of Object.entries(face.parts || {})) {
			const partBinding = face.bindings.find((entry) => entry.partId === candidatePartId);
			part.bindingStatus = partBinding ? 'bound' : 'unbound';
			part.reviewStatus = partBinding ? 'reviewed' : 'needs-review';
			part.componentIds = partBinding ? [...partBinding.componentIds] : [];
		}

		const boundComponentIds = new Set(face.bindings.flatMap((entry) => entry.componentIds || []));
		for (const component of face.components || []) {
			component.bindingStatus = boundComponentIds.has(component.componentId) ? 'bound' : 'unbound';
			component.reviewStatus = boundComponentIds.has(component.componentId) ? 'reviewed' : 'needs-review';
			component.partIds = face.bindings
				.filter((entry) => entry.componentIds.includes(component.componentId))
				.map((entry) => entry.partId);
		}

		this.refreshReferencePartGeometry(face);
	}

	refreshReferencePartGeometry(face) {
		const componentById = new Map((face.components || []).map((component) => [component.componentId, component]));

		for (const [partId, part] of Object.entries(face.parts || {})) {
			const partComponents = (part.componentIds || [])
				.map((componentId) => componentById.get(componentId))
				.filter(Boolean);
			const componentBounds = unionComponentBounds(partComponents.map((component) => component.bounds));

			part.componentBounds = componentBounds;
			part.targetBounds = componentBounds ? referencePixelsToViewBoxBounds(componentBounds, face.image) : null;
			part.dominantColor = dominantComponentColor(partComponents);
			part.paletteColors = uniqueValues(partComponents.flatMap((component) => component.paletteColors || []));
		}

		for (const component of face.components || []) {
			const componentParts = (component.partIds || [])
				.map((partId) => face.parts?.[partId])
				.filter(Boolean);
			component.globalPartIds = uniqueValues(componentParts.map((part) => part.globalPartId));
			component.semanticRoles = uniqueValues(componentParts.map((part) => part.role));
		}
	}

	collectReferenceStructureColors(structure) {
		const colors = new Set();

		for (const face of Object.values(structure?.faces || {})) {
			for (const part of Object.values(face.parts || {})) {
				this.addReferenceColors(colors, part);
			}

			for (const component of face.components || []) {
				this.addReferenceColors(colors, component);
			}
		}

		return [...colors].sort();
	}

	addReferenceColors(colors, item) {
		for (const color of [item?.dominantColor, ...(item?.paletteColors || [])]) {
			const normalized = this.normalizeHexColor(color, { uppercase: true });

			if (normalized) {
				colors.add(normalized);
			}
		}
	}

	applyPaletteColorToStructure(structure, color) {
		let partCount = 0;
		let componentCount = 0;

		for (const face of Object.values(structure?.faces || {})) {
			for (const component of face.components || []) {
				if (this.colorMatchesReference(component, color)) {
					component.paletteColors = addUniqueColor(component.paletteColors, color);
					componentCount += 1;
				}
			}

			for (const part of Object.values(face.parts || {})) {
				if (this.colorMatchesReference(part, color)) {
					part.paletteColors = addUniqueColor(part.paletteColors, color);
					partCount += 1;
				}
			}
		}

		return { partCount, componentCount };
	}

	colorMatchesReference(item, color) {
		const candidateColors = [
			item?.dominantColor,
			...(item?.paletteColors || []),
		].filter(Boolean);

		return candidateColors.some((candidateColor) => colorsWithinWiggle(candidateColor, color));
	}

	componentSemanticOrder(component, partOrder) {
		const partIds = component.partIds || [];
		const orders = partIds
			.map((partId) => partOrder.get(partId))
			.filter(Number.isFinite);

		return orders.length > 0 ? Math.min(...orders) : Number.POSITIVE_INFINITY;
	}

	normalizeHexColor(color, { uppercase = false } = {}) {
		const normalized = String(color || '').trim().replace(/^#/, '');
		const hex = normalized.length === 3
			? normalized.split('').map((digit) => digit + digit).join('')
			: normalized;

		if (!/^[0-9a-f]{6}$/i.test(hex)) {
			return '';
		}

		return uppercase ? `#${hex.toUpperCase()}` : `#${hex.toLowerCase()}`;
	}
}

function titleCase(value) {
	return String(value || '')
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

function referencePixelsToViewBoxBounds(bounds, image) {
	const width = image?.width || 164;
	const height = image?.height || 238;
	const scaleX = 94 / width;
	const scaleY = 136 / height;

	return {
		left: roundBoundsNumber(bounds.left * scaleX),
		top: roundBoundsNumber(bounds.top * scaleY),
		right: roundBoundsNumber(bounds.right * scaleX),
		bottom: roundBoundsNumber(bounds.bottom * scaleY),
		width: roundBoundsNumber(bounds.width * scaleX),
		height: roundBoundsNumber(bounds.height * scaleY),
	};
}

function unionComponentBounds(boundsList) {
	const usable = boundsList.filter(Boolean);

	if (usable.length === 0) {
		return null;
	}

	const left = Math.min(...usable.map((bounds) => bounds.left));
	const top = Math.min(...usable.map((bounds) => bounds.top));
	const right = Math.max(...usable.map((bounds) => bounds.right));
	const bottom = Math.max(...usable.map((bounds) => bounds.bottom));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function dominantComponentColor(components) {
	const counts = new Map();

	for (const component of components) {
		for (const color of component.paletteColors?.length ? component.paletteColors : [component.dominantColor]) {
			if (!color) {
				continue;
			}

			counts.set(color, (counts.get(color) || 0) + (component.pixels || 1));
		}
	}

	return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function colorsWithinWiggle(left, right) {
	const leftRgb = hexToRgb(left);
	const rightRgb = hexToRgb(right);
	const distanceSquared = leftRgb.reduce((total, channel, index) => {
		const delta = channel - rightRgb[index];
		return total + (delta * delta);
	}, 0);

	return distanceSquared <= COLOR_WIGGLE_DISTANCE_SQUARED;
}

function hexToRgb(color) {
	const normalized = String(color || '').replace(/^#/, '');
	const hex = normalized.length === 3
		? normalized.split('').map((digit) => digit + digit).join('')
		: normalized;
	const value = Number.parseInt(hex, 16);

	if (!Number.isFinite(value) || hex.length !== 6) {
		return [0, 0, 0];
	}

	return [
		(value >> 16) & 255,
		(value >> 8) & 255,
		value & 255,
	];
}

function addUniqueColor(colors = [], color) {
	const existing = new Set(colors.map((entry) => String(entry || '').toUpperCase()));

	if (existing.has(color)) {
		return colors;
	}

	return [...colors, color];
}

function uniqueValues(values) {
	return [...new Set(values.filter(Boolean))];
}

function roundBoundsNumber(value) {
	return Number(value.toFixed(3));
}

new ReferenceApprovalModel();
