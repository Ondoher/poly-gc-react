import fs from 'fs';
import path from 'path';
import { OUTPUT_3D_DIR } from '../shared/asset-paths.js';

export const DEFAULT_REFERENCE_STRUCTURE_PATH = path.resolve(
	OUTPUT_3D_DIR,
	'reference-structure',
	'default-large-faces',
	'reference-structure.json',
);

export function loadStructureBackedReferenceComponents(faceKey, options = {}) {
	const structurePath = options.structurePath || DEFAULT_REFERENCE_STRUCTURE_PATH;

	if (!fs.existsSync(structurePath)) {
		return null;
	}

	const structure = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
	const face = structure.faces?.[faceKey];

	if (!face) {
		return null;
	}

	return (face.components || [])
		.filter((component) => options.includeLabels || !isLabelComponent(component, face.parts))
		.map((component) => structureComponentToMatcherComponent(component, face.parts));
}

function structureComponentToMatcherComponent(component, parts) {
	const bounds = component.bounds || {};
	const componentParts = (component.partIds || [])
		.map((partId) => parts?.[partId])
		.filter(Boolean);

	return {
		...bounds,
		...component,
		bounds,
		partIds: component.partIds || [],
		globalPartIds: component.globalPartIds?.length
			? component.globalPartIds
			: uniqueValues(componentParts.map((part) => part.globalPartId)),
		semanticRoles: component.semanticRoles?.length
			? component.semanticRoles
			: uniqueValues(componentParts.map((part) => part.role)),
	};
}

function isLabelComponent(component, parts) {
	return (component.partIds || [])
		.map((partId) => parts?.[partId])
		.some((part) => part?.contentKind === 'label');
}

function uniqueValues(values) {
	return [...new Set(values.filter(Boolean))];
}
