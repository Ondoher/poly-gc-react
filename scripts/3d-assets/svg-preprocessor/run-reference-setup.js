import fs from 'fs';
import path from 'path';
import { OUTPUT_3D_DIR, ROOT_DIR } from '../shared/asset-paths.js';
import { extractReferenceImageComponents } from './reference-image-components.js';
import { autoAssignComponentsToSemanticParts } from './component-auto-assignment.js';
import { requireArgument } from './cli-arguments.js';

async function main() {
	const descriptorPath = path.resolve(process.cwd(), requireArgument('--descriptor'));
	const descriptorDir = path.dirname(descriptorPath);
	const descriptor = readJson(descriptorPath);
	const bootstrapPath = resolveRepoPath(descriptor.semanticBootstrap?.path, descriptorDir);
	const bootstrap = readJson(bootstrapPath);
	const svgPipeline = bootstrap.svgPipeline;
	const bootstrapFaces = svgPipeline.faces || {};
	const assignmentHints = svgPipeline.assignmentHints || {};
	const sourceDir = resolveRepoPath(descriptor.source?.path, descriptorDir);
	const referenceSetId = descriptor.referenceSetId;
	const outputDir = path.resolve(OUTPUT_3D_DIR, 'reference-structure', referenceSetId);
	const componentsDir = path.resolve(outputDir, 'components');
	const faceKeys = Object.keys(bootstrapFaces).sort(compareText);
	const generatedOn = new Date().toISOString();
	const structure = {
		schemaVersion: 1,
		status: 'active',
		generatedOn,
		lifecycle: {
			status: 'active',
			generatedOn,
			updatedOn: generatedOn,
		},
		referenceSet: {
			referenceSetId,
			name: descriptor.name,
			descriptorPath: formatPath(descriptorPath),
			source: descriptor.source,
			coordinateSpace: descriptor.coordinateSpace,
			palette: descriptor.palette,
		},
		semanticBootstrap: {
			bootstrapId: bootstrap.bootstrapId,
			name: bootstrap.name,
			semanticCatalogVersion: bootstrap.semanticCatalogVersion,
			path: formatPath(bootstrapPath),
			assignmentHints,
		},
		faces: {},
	};
	let componentCount = 0;
	let bindingCount = 0;

	fs.mkdirSync(componentsDir, { recursive: true });

	for (const faceKey of faceKeys) {
		const sourceFile = filenameForFace(descriptor, faceKey);
		const sourcePath = path.resolve(sourceDir, sourceFile);
		const reference = await extractReferenceImageComponents(sourcePath, {
			palette: descriptor.palette,
			segmentationDistanceThreshold: descriptor.palette?.segmentationDistanceThreshold,
		});
		const components = reference.components.map((component, index) => formatComponent(faceKey, component, index));
		const bootstrapFace = bootstrapFaces[faceKey];
		const parts = formatParts(bootstrapFace);
		const assignment = autoAssignComponentsToSemanticParts({
			faceKey,
			face: bootstrapFace,
			parts,
			components,
			assignmentHints,
		});
		const image = {
			width: reference.image.width,
			height: reference.image.height,
		};
		const preparedViewBox = descriptor.coordinateSpace?.preparedViewBox || [0, 0, 94, 136];
		const semanticParts = addPartGeometry(assignment.parts, assignment.components, image, preparedViewBox);
		const faceStatus = components.length > 0 ? assignment.status : 'needs-review-empty';

		structure.faces[faceKey] = {
			faceKey,
			faceShortCode: bootstrapFace.faceShortCode,
			family: bootstrapFace.family,
			value: bootstrapFace.value ?? null,
			sourceFile: formatPath(sourcePath),
			image,
			status: faceStatus,
			parts: semanticParts,
			components: addComponentSemanticMetadata(assignment.components, semanticParts),
			bindings: assignment.bindings,
			autoAssignment: assignment.autoAssignment,
		};

		const componentArtifact = {
			schemaVersion: 1,
			referenceSetId,
			faceKey,
			sourceFile: formatPath(sourcePath),
			image: structure.faces[faceKey].image,
			components: structure.faces[faceKey].components,
		};

		fs.writeFileSync(
			path.resolve(componentsDir, `${faceKey}.json`),
			`${JSON.stringify(componentArtifact, null, 2)}\n`,
		);

		componentCount += components.length;
		bindingCount += assignment.bindings.length;
	}

	const structurePath = path.resolve(outputDir, 'reference-structure.json');

	fs.writeFileSync(structurePath, `${JSON.stringify(structure, null, 2)}\n`);

	console.log(JSON.stringify({
		referenceSetId,
		faceCount: faceKeys.length,
		componentCount,
		bindingCount,
		structurePath: formatPath(structurePath),
		componentsDir: formatPath(componentsDir),
	}, null, 2));
}

function addPartGeometry(parts, components, image, preparedViewBox) {
	const componentById = new Map(components.map((component) => [component.componentId, component]));

	return Object.fromEntries(Object.entries(parts || {}).map(([partId, part]) => {
		const partComponents = (part.componentIds || [])
			.map((componentId) => componentById.get(componentId))
			.filter(Boolean);
		const componentBounds = unionBounds(partComponents.map((component) => component.bounds));

		return [
			partId,
			{
				...part,
				componentBounds,
				targetBounds: componentBounds ? referencePixelsToViewBox(componentBounds, image, preparedViewBox) : null,
				dominantColor: dominantColor(partComponents),
				paletteColors: uniqueValues(partComponents.flatMap((component) => component.paletteColors || [])),
			},
		];
	}));
}

function addComponentSemanticMetadata(components, parts) {
	return components.map((component) => {
		const componentParts = (component.partIds || [])
			.map((partId) => parts[partId])
			.filter(Boolean);

		return {
			...component,
			globalPartIds: uniqueValues(componentParts.map((part) => part.globalPartId)),
			semanticRoles: uniqueValues(componentParts.map((part) => part.role)),
		};
	});
}

function referencePixelsToViewBox(bounds, image, preparedViewBox) {
	const [, , viewBoxWidth, viewBoxHeight] = preparedViewBox;
	const scaleX = viewBoxWidth / image.width;
	const scaleY = viewBoxHeight / image.height;

	return {
		left: round(bounds.left * scaleX),
		top: round(bounds.top * scaleY),
		right: round(bounds.right * scaleX),
		bottom: round(bounds.bottom * scaleY),
		width: round(bounds.width * scaleX),
		height: round(bounds.height * scaleY),
	};
}

function unionBounds(boundsList) {
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

function dominantColor(components) {
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

function uniqueValues(values) {
	return [...new Set(values.filter(Boolean))];
}

function formatParts(face) {
	return Object.fromEntries(Object.entries(face.parts || {}).map(([partId, part]) => [
		partId,
		{
			...part,
			bindingStatus: 'unbound',
			reviewStatus: 'needs-review',
		},
	]));
}

function formatComponent(faceKey, component, index) {
	return {
		componentId: `ref.${faceKey}.${String(index + 1).padStart(4, '0')}`,
		bounds: {
			left: component.left,
			top: component.top,
			right: component.right,
			bottom: component.bottom,
			width: component.width,
			height: component.height,
		},
		center: {
			x: round(component.center?.x ?? component.left + (component.width / 2)),
			y: round(component.center?.y ?? component.top + (component.height / 2)),
		},
		pixels: component.pixels,
		area: component.area,
		dominantColor: component.dominantColor,
		paletteColors: component.colors || [],
		bindingStatus: 'unbound',
		reviewStatus: 'needs-review',
	};
}

function filenameForFace(descriptor, faceKey) {
	return descriptor.source.filenamePattern.replace('{faceShortCode}', faceKey);
}

function readJson(filename) {
	return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function resolveRepoPath(value, descriptorDir) {
	if (!value) {
		return '';
	}

	if (path.isAbsolute(value)) {
		return value;
	}

	const fromRoot = path.resolve(ROOT_DIR, value);
	if (fs.existsSync(fromRoot)) {
		return fromRoot;
	}

	return path.resolve(descriptorDir, value);
}

function round(value) {
	return Number(value.toFixed(3));
}

function compareText(left, right) {
	return left.localeCompare(right);
}

function formatPath(filename) {
	return path.relative(ROOT_DIR, filename).replaceAll('\\', '/');
}

await main();

