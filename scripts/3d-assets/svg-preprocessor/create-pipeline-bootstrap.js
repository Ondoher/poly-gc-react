import fs from 'fs/promises';
import path from 'path';
import { ASSETS_3D_JSON_DIR, ROOT_DIR } from '../shared/asset-paths.js';
import { normalizePath } from './preprocessed-face-validation-utils.js';

const REFERENCE_SEMANTICS_PATH = path.resolve(
	ASSETS_3D_JSON_DIR,
	'reference-semantics',
	'mahjong-face-reference-semantics.json',
);
const OUTPUT_PATH = path.resolve(
	ASSETS_3D_JSON_DIR,
	'pipeline-bootstrap',
	'mahjong-source-pipeline-bootstrap.json',
);

const SUIT_ID_BY_FAMILY = {
	bamboo: 'bamboo',
	characters: 'characters',
	dots: 'dots',
	winds: 'winds',
	dragons: 'dragons',
	flowers: 'flowers',
	seasons: 'seasons',
};

async function main() {
	const referenceSemantics = JSON.parse(await fs.readFile(REFERENCE_SEMANTICS_PATH, 'utf8'));
	const bootstrap = buildPipelineBootstrap(referenceSemantics);

	await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
	await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(bootstrap, null, 2)}\n`, 'utf8');

	console.log(`Wrote ${normalizePath(path.relative(ROOT_DIR, OUTPUT_PATH))}`);
}

function buildPipelineBootstrap(referenceSemantics) {
	const svgPipeline = referenceSemantics.svgPipeline;

	return {
		schemaVersion: 2,
		bootstrapId: 'mahjong-source-pipeline-bootstrap',
		name: 'Mahjong Source Pipeline Bootstrap',
		configuration: buildConfiguration(referenceSemantics),
		rendering: buildRendering(),
		svgPipeline: {
			faces: buildFaces(svgPipeline.faces || {}),
		},
		assetPipeline: {
			schemaVersion: 1,
			faces: {},
		},
		artifacts: {},
	};
}

function buildConfiguration(referenceSemantics) {
	return {
		defaults: {
			referenceSetId: 'default-large-faces',
			optionalPartAssignment: {
				initialCandidateScoring: {
					locationPreference: {
						source: 'initial',
						region: 'either-corner',
						regions: ['top-left', 'top-right'],
						mode: 'weighted',
					},
					sizePreference: {
						source: 'initial',
						metric: 'max-dimension-to-source-width',
						idealRatio: 0.25,
						nearZeroBelowRatio: 0.1,
						nearZeroAboveRatio: 0.4,
						mode: 'weighted',
					},
				},
			},
			suits: {
				bamboo: {
					parts: {
						label: sourceExpectation(),
					},
				},
				characters: {
					parts: {
						label: sourceExpectation(),
					},
				},
				dots: {
					parts: {
						label: sourceExpectation(),
					},
				},
				winds: {
					parts: {
						label: sourceExpectation(),
					},
				},
				dragons: {
					parts: {
						label: sourceExpectation('no-preference'),
					},
				},
				flowers: {
					layout: {
						optionalPair: 'label-right-character-left',
					},
					parts: {
						label: sourceExpectation(),
						glyph: sourceExpectation(),
					},
				},
				seasons: {
					layout: {
						optionalPair: 'label-left-character-right',
					},
					parts: {
						label: sourceExpectation(),
						glyph: sourceExpectation(),
					},
				},
			},
			faces: {},
		},
		overrides: {
			suits: {},
			faces: {
				'b-8': {
					parts: {
						label: sourceExpectation('center'),
					},
				},
				'dragon-w': {
					parts: {
						mainArtwork: {
							allowEmpty: true,
						},
					},
				},
			},
		},
	};
}

function sourceExpectation(region) {
	return {
		sourceSearch: {
			region: region || 'either-corner',
		},
	};
}

function buildRendering() {
	return {
		defaults: {
			optionalParts: {
				outputPresent: true,
			},
			color: {
				policy: 'reference-color',
			},
			suits: {
				bamboo: {
					parts: {
						label: generatedLabel('suit-label'),
					},
				},
				characters: {
					parts: {
						label: generatedLabel('suit-label'),
					},
				},
				dots: {
					parts: {
						label: generatedLabel('suit-label'),
					},
				},
				winds: {
					parts: {
						label: generatedLabel('wind-label'),
					},
				},
				dragons: {
					layout: {
						scaleMode: 'largest-containing-box',
					},
					parts: {
						label: defaultOnLabel('dragon-label'),
					},
				},
				flowers: {
					parts: {
						label: generatedLabel('suit-label'),
						glyph: sourcePreferredGlyph('flower-character'),
					},
				},
				seasons: {
					parts: {
						label: generatedLabel('suit-label'),
						glyph: sourcePreferredGlyph('season-character'),
					},
				},
			},
			faces: {},
		},
		overrides: {
			suits: {},
			faces: {},
		},
	};
}

function generatedLabel(role) {
	return renderPart('label', 'label', role, 'generated', 'generated');
}

function defaultOnLabel(role) {
	return renderPart('label', 'label', role, 'default-on', 'default');
}

function sourcePreferredGlyph(role) {
	return renderPart('glyph', 'glyph', role, 'source-preferred', 'source-preferred');
}

function renderPart(partId, contentKind, role, source, renderMode) {
	return {
		partId,
		contentKind,
		role,
		outputPresent: true,
		source,
		renderMode,
	};
}

function buildFaces(referenceFaces) {
	return Object.fromEntries(Object.entries(referenceFaces)
		.map(([faceKey, face]) => [faceKey, buildFace(face)]));
}

function buildFace(face) {
	return {
		suitId: SUIT_ID_BY_FAMILY[face.family] || face.family,
		...(face.value !== undefined ? { value: face.value } : {}),
		state: {
			components: {},
			shapes: {},
			parts: buildParts(face),
			bindings: {},
		},
		artifacts: {},
	};
}

function buildParts(face) {
	const parts = Object.fromEntries(Object.entries(face.parts || {})
		.map(([partId, part]) => [partId, buildPart(part)]));

	if (face.family === 'dragons' && !parts.label) {
		parts.label = {
			partId: 'label',
			globalPartId: `${face.faceShortCode}:label`,
			role: 'dragon-label',
			contentKind: 'label',
			colorStrategy: 'monochrome-reference',
		};
	}

	return parts;
}

function buildPart(part) {
	return {
		partId: part.partId,
		globalPartId: part.globalPartId,
		role: part.role,
		...(part.contentKind ? { contentKind: part.contentKind } : {}),
		colorStrategy: colorStrategyForPart(part),
		...(part.text ? { text: part.text } : {}),
		...(part.paletteIndex ? { paletteIndex: part.paletteIndex } : {}),
	};
}

function colorStrategyForPart(part) {
	if (part.contentKind === 'label'
		|| part.contentKind === 'glyph'
		|| /(?:label|character)$/i.test(part.role || '')) {
		return 'monochrome-reference';
	}

	if (part.contentKind === 'artwork'
		&& ['dragon-artwork', 'main-artwork'].includes(part.role)) {
		return 'freeform-palette';
	}

	return 'reference-shaded';
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
