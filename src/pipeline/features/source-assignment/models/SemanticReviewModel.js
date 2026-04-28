import PipelinePresentationModel from './PipelinePresentationModel.js';
import RenderingGeometryModel from './RenderingGeometryModel.js';

export default class SemanticReviewModel {
	static referencePartLabel(partId, part) {
		if (partId === "mainArtwork") {
			return "Artwork";
		}

		if (part?.role === "character-body") {
			return "Character Body";
		}

		if (part?.role === "wind-character") {
			return part?.text ? `Wind ${part.text}` : "Wind Character";
		}

		if (part?.role === "wind-label") {
			return part?.text ? `Label ${part.text}` : "Wind Label";
		}

		if (part?.role === "character-number-glyph") {
			return part?.text ? `Number Glyph ${part.text}` : "Number Glyph";
		}

		if (part?.role?.endsWith("-character")) {
			return part?.text ? `Character ${part.text}` : "Character";
		}

		if (part?.contentKind === "label" || partId === "label") {
			return part?.text ? `Label ${part.text}` : "Label";
		}

		if (part?.role?.includes("number") || partId === "number") {
			return part?.text ? `Number ${part.text}` : "Number";
		}

		const roleBase = PipelinePresentationModel.titleCase((part?.role || partId).replace(/^suit-/, "").replace(/^main-/, ""));
		const ordinalMatch = partId.match(/^(.*)\.(\d+)$/);

		if (ordinalMatch) {
			return `${PipelinePresentationModel.titleCase(ordinalMatch[1])} ${ordinalMatch[2]}`;
		}

		return roleBase;
	}

	static sortComponentsForReview(components, partEntries) {
		const partOrder = new Map(partEntries.map(([partId], index) => [partId, index]));
		const originalOrder = new Map(components.map((component, index) => [component.componentId, index]));

		return [...components].sort((left, right) => {
			const leftPartOrder = SemanticReviewModel.componentSemanticOrder(left, partOrder);
			const rightPartOrder = SemanticReviewModel.componentSemanticOrder(right, partOrder);

			if (leftPartOrder !== rightPartOrder) {
				return leftPartOrder - rightPartOrder;
			}

			return (originalOrder.get(left.componentId) ?? 0) - (originalOrder.get(right.componentId) ?? 0);
		});
	}

	static componentSemanticOrder(component, partOrder) {
		const partIds = component.partIds || [];
		const orders = partIds
			.map((partId) => partOrder.get(partId))
			.filter(Number.isFinite);

		return orders.length > 0 ? Math.min(...orders) : Number.POSITIVE_INFINITY;
	}

	static referenceStructureSummary(structure) {
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
		const paletteColorSet = SemanticReviewModel.paletteColorSet(structure?.referenceSet?.palette);
		const unknownPaletteColors = SemanticReviewModel.collectReferenceStructureColors(structure)
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

	static initialReferenceStructureSelection(structure) {
		const summary = SemanticReviewModel.referenceStructureSummary(structure);
		const faceKey = summary.incompleteFaces[0] || Object.keys(structure?.faces || {})[0] || "";
		const firstUnboundPart = summary.unboundParts.find((part) => part.faceKey === faceKey);

		return {
			faceKey,
			partId: firstUnboundPart?.partId || "",
			componentIds: [],
		};
	}

	static markReferenceStructureAccepted(structure, summary) {
		const acceptedOn = new Date().toISOString();
		const accepted = structuredClone(structure);

		accepted.reviewStatus = "accepted";
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
			reviewStatus: "accepted",
			acceptedOn,
		};

		for (const face of Object.values(accepted.faces || {})) {
			face.reviewStatus = "accepted";
			face.acceptedOn = acceptedOn;
		}

		return accepted;
	}

	static collectReferenceStructureColors(structure) {
		const colors = new Set();

		for (const face of Object.values(structure?.faces || {})) {
			for (const part of Object.values(face.parts || {})) {
				SemanticReviewModel.addReferenceColors(colors, part);
			}

			for (const component of face.components || []) {
				SemanticReviewModel.addReferenceColors(colors, component);
			}
		}

		return [...colors].sort();
	}

	static addReferenceColors(colors, item) {
		for (const color of [item?.dominantColor, ...(item?.paletteColors || [])]) {
			const normalized = PipelinePresentationModel.normalizeHexColor(color, { uppercase: true });

			if (normalized) {
				colors.add(normalized);
			}
		}
	}

	static paletteColorSet(palette) {
		return new Set((palette?.colors || [])
			.filter((entry) => entry.disabled !== true)
			.map((entry) => PipelinePresentationModel.normalizeHexColor(entry.color, { uppercase: true }))
			.filter(Boolean));
	}

	static referenceColorSwatch(item, paletteColorSet) {
		const paletteColors = item?.paletteColors || [];
		const color = paletteColors.includes(item?.dominantColor)
			? item.dominantColor
			: paletteColors[0] || item?.dominantColor || "";
		const known = Boolean(color && paletteColorSet?.has(PipelinePresentationModel.normalizeHexColor(color, { uppercase: true })));

		return {
			color,
			known,
			title: known
				? `Palette color ${color || "unknown"}`
				: `Identified color ${color || "unknown"}; no palette color`,
		};
	}

	static sourceAssignmentFaces({ sourceAcceptance, referenceStructure, sourceSemanticBindings, sourceSemanticPartStates }) {
		return Object.entries(sourceAcceptance?.faces || {})
			.map(([faceKey, sourceFace]) => SemanticReviewModel.makeSourceSemanticFace({
				faceKey,
				sourceFace,
				referenceFace: referenceStructure?.faces?.[faceKey],
				bindings: sourceSemanticBindings?.[faceKey],
				partStates: sourceSemanticPartStates?.[faceKey],
			}))
			.filter(Boolean);
	}

	static makeSourceSemanticFace({ faceKey, sourceFace, referenceFace, bindings, partStates }) {
		if (!faceKey || !sourceFace || !referenceFace) {
			return null;
		}

		const bindingEntries = Object.entries(bindings || {})
			.filter(([componentId, binding]) => componentId && binding?.partId && binding.strength !== "none")
			.map(([componentId, binding]) => ({
				bindingId: `source-bind.${faceKey}.${componentId}`,
				partId: binding.partId,
				componentIds: [componentId],
				strength: binding.strength || "tentative",
				bindingStrength: SemanticReviewModel.canonicalBindingStrength(binding.strength),
				strategy: binding.source || (binding.strength === "strong" || binding.strength === "accepted" ? "manual" : "alignment-source-part-mapping"),
				reviewStatus: binding.reviewStatus || (binding.strength === "strong" || binding.strength === "accepted" ? "reviewed" : "inferred"),
			}));
		const componentPartIds = new Map();

		for (const binding of bindingEntries) {
			for (const componentId of binding.componentIds) {
				const partIds = componentPartIds.get(componentId) || [];
				partIds.push(binding.partId);
				componentPartIds.set(componentId, partIds);
			}
		}

		const activePartStates = partStates || {};
		const canonicalParts = sourceFace.sourceParts || {};
		const sourcePartEntries = SemanticReviewModel.sourcePartEntries(referenceFace.parts || {}, canonicalParts);
		const parts = Object.fromEntries(sourcePartEntries
			.map(([partId, referencePart]) => {
				const partBindings = bindingEntries.filter((binding) => binding.partId === partId);
				const componentIds = partBindings.flatMap((binding) => binding.componentIds || []);
				const partState = SemanticReviewModel.sourcePartState(partId, activePartStates, canonicalParts);
				const bindingStatus = componentIds.length > 0
					? "bound"
					: "unbound";

				return [
					partId,
					{
						...referencePart,
						partId,
						componentIds,
						bindingStrength: SemanticReviewModel.strongestBindingStrength(partBindings),
						sourceAssignmentType: componentIds.length > 0 ? "source" : partState.state,
						bindingStatus,
						reviewStatus: partState.reviewStatus || (bindingStatus === "bound" ? "reviewed" : "needs-review"),
					},
				];
			}));
		const sourceComponents = (sourceFace.components || [])
			.map((component) => {
				const partIds = componentPartIds.get(component.componentId) || [];

				return {
					...component,
					bindingStatus: partIds.length > 0 ? "bound" : "unbound",
					bindingStrength: SemanticReviewModel.strongestBindingStrength(bindingEntries.filter((binding) => binding.componentIds.includes(component.componentId))),
					reviewStatus: partIds.length > 0 ? "reviewed" : "needs-review",
					partIds,
				};
			});
		const components = sourceComponents
			.filter((component) => component.alignmentCandidate !== false)
			.map((component) => component);

		return {
			faceKey,
			sourceFile: sourceFace.sourceFile,
			identifiedComponentsSvg: sourceFace.identifiedComponentsSvg,
			viewBox: sourceFace.viewBox,
			canvas: RenderingGeometryModel.canvasFromSourceViewBox(sourceFace.viewBox, sourceFace.alignmentBounds),
			parts,
			components,
			sourceComponents,
			bindings: bindingEntries,
		};
	}

	static sourcePartEntries(referenceParts, canonicalParts) {
		return Object.keys(canonicalParts || {}).map((partId) => {
			const canonicalPart = canonicalParts?.[partId] || {};

			return [
				partId,
				{
					...canonicalPart,
					...(referenceParts?.[partId] || {}),
					partId,
				},
			];
		});
	}

	static sourcePartState(partId, activePartStates, canonicalParts) {
		if (activePartStates?.[partId]) {
			return activePartStates[partId];
		}

		const canonicalPart = canonicalParts?.[partId] || {};

		return ["accepted", "reviewed"].includes(canonicalPart.reviewStatus)
			? {
				state: "unbound",
				strength: "none",
				reviewStatus: canonicalPart.reviewStatus,
			}
			: {};
	}

	static sourceAssignmentSummary(faces) {
		const partCount = faces.reduce((total, face) => total + Object.keys(face.parts || {}).length, 0);
		const componentCount = faces.reduce((total, face) => total + (face.components || []).length, 0);
		const bindingCount = faces.reduce((total, face) => total + (face.bindings || []).length, 0);
		const unboundParts = faces.flatMap((face) => (
			Object.entries(face.parts || {})
				.filter(([, part]) => !SemanticReviewModel.sourcePartSatisfied(part))
				.map(([partId]) => ({ faceKey: face.faceKey, partId }))
		));
		const unboundComponents = faces.flatMap((face) => (
			(face.components || [])
				.filter((component) => component.bindingStatus !== "bound")
				.map((component) => ({ faceKey: face.faceKey, componentId: component.componentId }))
		));

		return {
			faceCount: faces.length,
			partCount,
			componentCount,
			bindingCount,
			unboundPartCount: unboundParts.length,
			unboundComponentCount: unboundComponents.length,
			unboundParts,
			unboundComponents,
		};
	}

	static sourceAssignmentReviewSummary(sourceAcceptance, referenceStructure, sourceSemanticBindings, sourceSemanticPartStates) {
		return SemanticReviewModel.sourceAssignmentSummary(SemanticReviewModel.sourceAssignmentFaces({
			sourceAcceptance,
			referenceStructure,
			sourceSemanticBindings,
			sourceSemanticPartStates,
		}));
	}

	static strongestBindingStrength(bindings) {
		if ((bindings || []).some((binding) => binding.strength === "accepted")) {
			return "accepted";
		}

		if ((bindings || []).some((binding) => binding.strength === "strong")) {
			return "strong";
		}

		return bindings?.length ? "tentative" : "none";
	}

	static canonicalBindingStrength(strength) {
		if (strength === "accepted" || strength === "strong") {
			return strength;
		}
		if (strength === "tentative") {
			return "tentative";
		}
		if (strength === "none") {
			return "none";
		}

		throw new Error(`Invalid canonical source binding strength: ${strength || "(missing)"}`);
	}

	static sourcePartSatisfied(part) {
		return part?.bindingStatus === "bound"
			|| ["accepted", "reviewed"].includes(part?.reviewStatus)
			|| part?.allowEmpty === true;
	}
}
