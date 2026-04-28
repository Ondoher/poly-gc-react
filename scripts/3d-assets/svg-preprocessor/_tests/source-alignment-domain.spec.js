import path from 'path';
import { alignFace } from '../SourceAlignmentRunner.js';

describe('source alignment domain behavior', function() {
	it('uses optional part reservations before generic artwork matching', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'flower-1',
			normalizedComponents: [
				component('label-source', box(4, 4, 14, 20)),
				component('glyph-source', box(78, 4, 96, 28)),
				component('art-source', box(25, 45, 85, 125)),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-1',
				parts: {
					label: ['label-source'],
					glyph: ['glyph-source'],
				},
			}),
		});

		const labelGroup = findGroup(alignmentMap, 'label');
		const glyphGroup = findGroup(alignmentMap, 'glyph');
		const artworkGroup = findGroup(alignmentMap, 'mainArtwork');

		expect(labelGroup.matchStatus).toBe('matched');
		expect(labelGroup.sourceComponentIds).toEqual(['label-source']);
		expect(glyphGroup.sourceComponentIds).toEqual(['glyph-source']);
		expect(artworkGroup.sourceComponentIds).toEqual(['art-source']);
		expect(artworkGroup.sourceComponentIds).not.toContain('label-source');
		expect(artworkGroup.sourceComponentIds).not.toContain('glyph-source');
		expect(alignmentMap.sourcePartMappings.find((mapping) => mapping.referencePartIds.includes('label')).sourceComponentIds)
			.toEqual(['label-source']);
		expect(artworkGroup.diagnostics).toEqual([]);
	});

	it('allows absent optional parts to be reconsidered when source metadata finds components', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'b-1',
			referenceParts: {
				label: referencePart('suit-label', 'label', ['ref-label'], box(5, 5, 12, 18)),
				mainArtwork: referencePart('main-artwork', 'artwork', ['ref-art'], box(30, 40, 70, 110)),
			},
			referenceComponents: [
				referenceComponent('ref-label', box(5, 5, 12, 18)),
				referenceComponent('ref-art', box(30, 40, 70, 110)),
			],
			normalizedComponents: [
				component('legacy-label-source', box(4, 4, 14, 20)),
				component('art-source', box(25, 45, 85, 125)),
			],
			faceMetadata: {
				glyphLayout: {
					number: {
						sourcePresent: true,
						sourceBounds: box(4, 4, 14, 20),
					},
				},
			},
			optionalAssignment: optionalAssignment({
				faceKey: 'b-1',
				parts: {
					label: [],
				},
			}),
		});

		const labelGroup = findGroup(alignmentMap, 'label');
		const artworkGroup = findGroup(alignmentMap, 'mainArtwork');

		expect(labelGroup.sourceComponentIds).toEqual(['legacy-label-source']);
		expect(artworkGroup.sourceComponentIds).toEqual(['art-source']);
		expect(labelGroup.matchStatus).toBe('matched');
	});

	it('keeps generated label candidates as source label parts without matching them as artwork', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'b-2',
			referenceParts: {
				'bamboo.1': referencePart('bamboo-stick', 'artwork', ['ref-bamboo-1'], box(35, 25, 58, 70)),
				'bamboo.2': referencePart('bamboo-stick', 'artwork', ['ref-bamboo-2'], box(36, 74, 60, 124)),
				label: referencePart('suit-label', 'label', ['ref-label'], box(5, 5, 18, 24)),
			},
			referenceComponents: [
				referenceComponent('ref-bamboo-1', box(35, 25, 58, 70), { partIds: ['bamboo.1'], semanticRoles: ['bamboo-stick'] }),
				referenceComponent('ref-bamboo-2', box(36, 74, 60, 124), { partIds: ['bamboo.2'], semanticRoles: ['bamboo-stick'] }),
				referenceComponent('ref-label', box(5, 5, 18, 24), { partIds: ['label'], semanticRoles: ['suit-label'] }),
			],
			normalizedComponents: [
				component('top-bamboo-source', box(80, 20, 92, 65)),
				component('bottom-bamboo-source', box(80, 72, 92, 122)),
				component('label-source', box(5, 5, 18, 24)),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'b-2',
				parts: {
					label: ['label-source'],
				},
				outputParts: {
					label: { source: 'generated', renderMode: 'generated' },
				},
			}),
		});

		const bambooGroup = findGroup(alignmentMap, 'bamboo');
		const labelGroup = findGroup(alignmentMap, 'label');

		expect(bambooGroup.sourceComponentIds).toEqual(jasmine.arrayWithExactContents(['top-bamboo-source', 'bottom-bamboo-source']));
		expect(bambooGroup.sourceComponentIds).not.toContain('label-source');
		expect(labelGroup.sourceComponentIds).toEqual(['label-source']);
		expect(labelGroup.matchStatus).toBe('matched');
	});

	it('marks alignment as needs-review when the optional part assignment artifact is missing', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'flower-1',
			normalizedComponents: [
				component('art-source', box(25, 45, 85, 125)),
			],
			optionalAssignment: null,
		});

		expect(alignmentMap.status).toBe('needs-review');
		expect(alignmentMap.inputs.optionalPartAssignment).toBeNull();
		expect(alignmentMap.diagnostics).toEqual(jasmine.arrayContaining([jasmine.objectContaining({
			code: 'missing-optional-part-assignment',
		})]));
	});

	it('maps character number glyphs separately from character bodies', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'c-1',
			referenceParts: {
				body: referencePart('character-body', 'glyph', ['ref-body-top', 'ref-body-bottom'], box(20, 42, 82, 124)),
				glyph: referencePart('character-number-glyph', 'glyph', ['ref-glyph'], box(28, 10, 74, 34)),
				label: referencePart('suit-label', 'label', ['ref-label'], box(5, 5, 12, 18)),
			},
			referenceComponents: [
				referenceComponent('ref-body-top', box(22, 45, 80, 68), { dominantColor: '#bf3718', partIds: ['body'], semanticRoles: ['character-body'] }),
				referenceComponent('ref-body-bottom', box(24, 72, 78, 122), { dominantColor: '#bf3718', partIds: ['body'], semanticRoles: ['character-body'] }),
				referenceComponent('ref-glyph', box(28, 10, 74, 34), { dominantColor: '#2a3b92', partIds: ['glyph'], semanticRoles: ['character-number-glyph'] }),
				referenceComponent('ref-label', box(5, 5, 12, 18), { partIds: ['label'], semanticRoles: ['suit-label'] }),
			],
			normalizedComponents: [
				component('glyph-source', box(28, 10, 74, 34), { fill: '#2a3b92' }),
				component('body-source', box(24, 60, 78, 128), { fill: '#bf3718' }),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'c-1',
				parts: {
					label: [],
				},
			}),
		});

		const bodyGroup = findGroup(alignmentMap, 'body');
		const glyphGroup = findGroup(alignmentMap, 'glyph');

		expect(bodyGroup.sourceComponentIds).toEqual(['body-source']);
		expect(glyphGroup.sourceComponentIds).toEqual(['glyph-source']);
	});

	it('prefers glyph color clusters over nearby character strokes for character number glyphs', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'c-1',
			referenceParts: {
				body: referencePart('character-body', 'glyph', ['ref-body-top', 'ref-body-bottom'], box(20, 42, 82, 124)),
				glyph: referencePart('character-number-glyph', 'glyph', ['ref-glyph'], box(28, 10, 74, 34)),
				label: referencePart('suit-label', 'label', ['ref-label'], box(5, 5, 12, 18)),
			},
			referenceComponents: [
				referenceComponent('ref-body-top', box(22, 45, 80, 68), { dominantColor: '#993300', partIds: ['body'], semanticRoles: ['character-body'] }),
				referenceComponent('ref-body-bottom', box(24, 72, 78, 122), { dominantColor: '#993300', partIds: ['body'], semanticRoles: ['character-body'] }),
				referenceComponent('ref-glyph', box(28, 10, 74, 34), { dominantColor: '#333333', partIds: ['glyph'], semanticRoles: ['character-number-glyph'] }),
				referenceComponent('ref-label', box(5, 5, 12, 18), { partIds: ['label'], semanticRoles: ['suit-label'] }),
			],
			normalizedComponents: [
				component('label-dark', box(9, 8, 15, 20), { fill: 'black' }),
				component('glyph-dark', box(26, 12, 70, 24), { fill: '#333333' }),
				component('character-upper-red', box(20, 32, 65, 46), { fill: '#993300' }),
				component('character-lower-red', box(18, 58, 72, 118), { fill: '#993300' }),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'c-1',
				parts: {
					label: [],
				},
			}),
		});

		const bodyGroup = findGroup(alignmentMap, 'body');
		const glyphGroup = findGroup(alignmentMap, 'glyph');

		expect(glyphGroup.sourceComponentIds).toEqual(jasmine.arrayWithExactContents(['label-dark', 'glyph-dark']));
		expect(glyphGroup.sourceComponentIds).not.toContain('character-upper-red');
		expect(bodyGroup.sourceComponentIds).toEqual(jasmine.arrayWithExactContents(['character-upper-red', 'character-lower-red']));
	});

	it('binds every remaining source component to free-form main artwork', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'flower-4',
			referenceParts: {
				label: referencePart('flower-label', 'label', ['ref-label'], box(5, 5, 12, 18)),
				glyph: referencePart('flower-character', 'glyph', ['ref-glyph'], box(76, 5, 92, 28)),
				mainArtwork: referencePart('main-artwork', 'artwork', ['ref-art-1', 'ref-art-2'], box(24, 42, 84, 124)),
			},
			referenceComponents: [
				referenceComponent('ref-label', box(5, 5, 12, 18), { partIds: ['label'], semanticRoles: ['flower-label'] }),
				referenceComponent('ref-glyph', box(76, 5, 92, 28), { partIds: ['glyph'], semanticRoles: ['flower-character'] }),
				referenceComponent('ref-art-1', box(24, 42, 54, 124), { partIds: ['mainArtwork'], semanticRoles: ['main-artwork'] }),
				referenceComponent('ref-art-2', box(56, 42, 84, 124), { partIds: ['mainArtwork'], semanticRoles: ['main-artwork'] }),
			],
			normalizedComponents: [
				component('label-source', box(4, 4, 14, 20)),
				component('glyph-source', box(78, 4, 96, 28)),
				component('art-source-1', box(25, 45, 40, 70)),
				component('art-source-2', box(50, 68, 70, 92)),
				component('art-source-3', box(72, 96, 85, 125)),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-4',
				parts: {
					label: ['label-source'],
					glyph: ['glyph-source'],
				},
			}),
		});

		const artworkGroup = findGroup(alignmentMap, 'mainArtwork');
		const artworkMapping = alignmentMap.sourcePartMappings.find((mapping) => mapping.sourcePartId === 'mainArtwork');

		expect(artworkGroup.strategy).toBe('freeform-artwork');
		expect(artworkGroup.matchStatus).toBe('matched-freeform-artwork');
		expect(artworkGroup.sourceComponentIds).toEqual(['art-source-1', 'art-source-2', 'art-source-3']);
		expect(artworkMapping.sourceComponentIds).toEqual(['art-source-1', 'art-source-2', 'art-source-3']);
		expect(alignmentMap.diagnostics).not.toEqual(jasmine.arrayContaining([jasmine.objectContaining({
			code: 'unmatched-source-components',
		})]));
	});

	it('uses draft source semantic bindings before heuristic source selection', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'flower-1',
			normalizedComponents: [
				component('label-source', box(4, 4, 14, 20)),
				component('manual-art-source', box(25, 45, 45, 80)),
				component('unbound-art-source', box(55, 85, 85, 125)),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-1',
				parts: {
					label: ['label-source'],
				},
			}),
			semanticMap: semanticMap({
				'label-source': {
					partId: 'label',
					strength: 'tentative',
					reviewStatus: 'inferred',
				},
				'manual-art-source': strongBinding('mainArtwork'),
			}),
		});

		const labelGroup = findGroup(alignmentMap, 'label');
		const artworkGroup = findGroup(alignmentMap, 'mainArtwork');
		const artworkMapping = alignmentMap.sourcePartMappings.find((mapping) => mapping.sourcePartId === 'mainArtwork');

		expect(alignmentMap.inputs.sourceSemanticAssignment).toEqual(jasmine.objectContaining({
			status: 'draft',
		}));
		expect(labelGroup.sourceComponentIds).toEqual(['label-source']);
		expect(artworkGroup.sourceComponentIds).toEqual(['manual-art-source']);
		expect(artworkGroup.sourceComponentIds).not.toContain('unbound-art-source');
		expect(artworkMapping.sourceComponentIds).toEqual(['manual-art-source']);
	});

	it('leaves stale assignment component ids available after a binding is removed', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'flower-1',
			normalizedComponents: [
				component('previously-bound-art-source', box(25, 45, 45, 80)),
				component('other-art-source', box(55, 85, 85, 125)),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-1',
				parts: {},
			}),
			semanticMap: {
				...semanticMap({}),
				assignments: [{
					assignmentId: 'assign.flower-1.mainArtwork',
					referencePartId: 'mainArtwork',
					sourceComponentIds: ['previously-bound-art-source'],
					assignmentType: 'source',
					reviewStatus: 'needs-review',
				}],
			},
		});

		const artworkGroup = findGroup(alignmentMap, 'mainArtwork');

		expect(artworkGroup.sourceComponentIds).toEqual(['previously-bound-art-source', 'other-art-source']);
		expect(alignmentMap.sourcePartMappings.find((mapping) => mapping.sourcePartId === 'mainArtwork').sourceComponentIds)
			.toEqual(['previously-bound-art-source', 'other-art-source']);
	});

	it('keeps overlapping layered dot stacks as individual repeated dot candidates', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'd-7',
			referenceParts: {
				'dot.1': referencePart('dot', 'artwork', ['ref-dot-1'], box(80, 0, 102, 22)),
				'dot.2': referencePart('dot', 'artwork', ['ref-dot-2'], box(40, 12, 62, 34)),
				'dot.3': referencePart('dot', 'artwork', ['ref-dot-3'], box(0, 24, 22, 46)),
				'dot.4': referencePart('dot', 'artwork', ['ref-dot-4'], box(18, 58, 40, 80)),
				'dot.5': referencePart('dot', 'artwork', ['ref-dot-5'], box(52, 58, 74, 80)),
				'dot.6': referencePart('dot', 'artwork', ['ref-dot-6'], box(18, 92, 40, 114)),
				'dot.7': referencePart('dot', 'artwork', ['ref-dot-7'], box(52, 92, 74, 114)),
			},
			referenceComponents: [
				referenceComponent('ref-dot-1', box(80, 0, 102, 22), { partIds: ['dot.1'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-2', box(40, 12, 62, 34), { partIds: ['dot.2'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-3', box(0, 24, 22, 46), { partIds: ['dot.3'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-4', box(18, 58, 40, 80), { partIds: ['dot.4'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-5', box(52, 58, 74, 80), { partIds: ['dot.5'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-6', box(18, 92, 40, 114), { partIds: ['dot.6'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-7', box(52, 92, 74, 114), { partIds: ['dot.7'], semanticRoles: ['dot'] }),
			],
			normalizedComponents: [
				...layeredDot('source-dot-1', 0, 0),
				...layeredDot('source-dot-2', 14, 5),
				...layeredDot('source-dot-3', 28, 10),
				...layeredDot('source-dot-4', 0, 42),
				...layeredDot('source-dot-5', 28, 42),
				...layeredDot('source-dot-6', 0, 70),
				...layeredDot('source-dot-7', 28, 70),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'd-7',
				parts: {},
			}),
		});

		const dotGroup = findGroup(alignmentMap, 'dot');
		const dotMappings = alignmentMap.sourcePartMappings
			.filter((mapping) => mapping.role === 'dot');

		expect(dotGroup.strategy).toBe('part-completion-split');
		expect(dotMappings.length).toBe(7);
		expect(dotMappings.every((mapping) => mapping.referencePartIds.length === 1)).toBeTrue();
		expect(dotMappings.every((mapping) => mapping.sourceComponentIds.length === 2)).toBeTrue();
		expect(dotMappings.map((mapping) => mapping.referencePartIds[0]))
			.toEqual(['dot.1', 'dot.2', 'dot.3', 'dot.4', 'dot.5', 'dot.6', 'dot.7']);
	});

	it('assigns remaining source fragments to complete each repeated part fit', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'd-3',
			referenceParts: {
				'dot.1': referencePart('dot', 'artwork', ['ref-dot-1'], box(55, 0, 90, 35)),
				'dot.2': referencePart('dot', 'artwork', ['ref-dot-2'], box(28, 45, 63, 80)),
				'dot.3': referencePart('dot', 'artwork', ['ref-dot-3'], box(0, 90, 35, 125)),
			},
			referenceComponents: [
				referenceComponent('ref-dot-1', box(55, 0, 90, 35), { partIds: ['dot.1'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-2', box(28, 45, 63, 80), { partIds: ['dot.2'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-3', box(0, 90, 35, 125), { partIds: ['dot.3'], semanticRoles: ['dot'] }),
			],
			normalizedComponents: [
				component('top-dot.outer', box(5, 0, 30, 25), { fill: '#000000' }),
				component('bottom-dot.outer', box(58, 72, 83, 97), { fill: '#069200' }),
				component('middle-dot.outer', box(32, 36, 57, 61), { fill: '#c20000' }),
				component('top-dot.inner', box(7, 2, 28, 23), { fill: '#9a9a9a' }),
				component('middle-dot.inner', box(34, 38, 55, 59), { fill: '#ff7777' }),
				component('bottom-dot.inner', box(60, 74, 81, 95), { fill: '#5be335' }),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'd-3',
				parts: {},
			}),
		});

		const dotGroup = findGroup(alignmentMap, 'dot');
		const dotMappings = alignmentMap.sourcePartMappings
			.filter((mapping) => mapping.role === 'dot');

		expect(dotGroup.matchStatus).toBe('matched');
		expect(dotMappings.map((mapping) => mapping.sourceComponentIds.length)).toEqual([2, 2, 2]);
		expect(dotMappings.flatMap((mapping) => mapping.sourceComponentIds).sort()).toEqual([
			'bottom-dot.inner',
			'bottom-dot.outer',
			'middle-dot.inner',
			'middle-dot.outer',
			'top-dot.inner',
			'top-dot.outer',
		]);
	});

	it('splits repeated artwork into matching position bands before completing each part', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'b-8',
			referenceParts: {
				'bambooGroup.1': referencePart('bamboo-group', 'artwork', ['ref-top-band'], box(8, 14, 82, 67)),
				'bambooGroup.2': referencePart('bamboo-group', 'artwork', ['ref-bottom-band'], box(8, 70, 82, 124)),
				label: referencePart('suit-label', 'label', ['ref-label'], box(40, 58, 52, 79)),
			},
			referenceComponents: [
				referenceComponent('ref-top-band', box(8, 14, 82, 67), { partIds: ['bambooGroup.1'], semanticRoles: ['bamboo-group'] }),
				referenceComponent('ref-bottom-band', box(8, 70, 82, 124), { partIds: ['bambooGroup.2'], semanticRoles: ['bamboo-group'] }),
				referenceComponent('ref-label', box(40, 58, 52, 79), { partIds: ['label'], semanticRoles: ['suit-label'] }),
			],
			normalizedComponents: [
				component('top-left-bamboo', box(8, 0, 32, 12)),
				component('top-right-bamboo', box(56, 0, 80, 12)),
				component('upper-left-bamboo', box(8, 18, 32, 42)),
				component('upper-right-bamboo', box(56, 18, 80, 42)),
				component('lower-left-bamboo', box(8, 66, 32, 90)),
				component('lower-right-bamboo', box(56, 66, 80, 90)),
				component('bottom-left-bamboo', box(8, 112, 32, 124)),
				component('bottom-right-bamboo', box(56, 112, 80, 124)),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'b-8',
				parts: {
					label: [],
				},
			}),
		});
		const topMapping = alignmentMap.sourcePartMappings.find((mapping) => mapping.sourcePartId === 'bambooGroup.1');
		const bottomMapping = alignmentMap.sourcePartMappings.find((mapping) => mapping.sourcePartId === 'bambooGroup.2');

		expect(topMapping.strategy).toBe('part-completion-split');
		expect(topMapping.sourceComponentIds).toEqual(jasmine.arrayWithExactContents([
			'top-left-bamboo',
			'top-right-bamboo',
			'upper-left-bamboo',
			'upper-right-bamboo',
		]));
		expect(bottomMapping.sourceComponentIds).toEqual(jasmine.arrayWithExactContents([
			'lower-left-bamboo',
			'lower-right-bamboo',
			'bottom-left-bamboo',
			'bottom-right-bamboo',
		]));
	});

	it('does not collapse multiple repeated reference parts onto one source dot', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'd-6',
			referenceParts: {
				'dot.1': referencePart('dot', 'artwork', ['ref-dot-1'], box(18, 0, 40, 22)),
				'dot.2': referencePart('dot', 'artwork', ['ref-dot-2'], box(52, 0, 74, 22)),
				'dot.3': referencePart('dot', 'artwork', ['ref-dot-3'], box(18, 34, 40, 56)),
				'dot.4': referencePart('dot', 'artwork', ['ref-dot-4'], box(52, 34, 74, 56)),
				'dot.5': referencePart('dot', 'artwork', ['ref-dot-5'], box(18, 68, 40, 90)),
				'dot.6': referencePart('dot', 'artwork', ['ref-dot-6'], box(52, 68, 74, 90)),
			},
			referenceComponents: [
				referenceComponent('ref-dot-1', box(18, 0, 40, 22), { partIds: ['dot.1'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-2', box(52, 0, 74, 22), { partIds: ['dot.2'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-3', box(18, 34, 40, 56), { partIds: ['dot.3'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-4', box(52, 34, 74, 56), { partIds: ['dot.4'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-5', box(18, 68, 40, 90), { partIds: ['dot.5'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-6', box(52, 68, 74, 90), { partIds: ['dot.6'], semanticRoles: ['dot'] }),
			],
			normalizedComponents: [
				component('top-left-dot', box(18, 0, 40, 22), { fill: '#006633' }),
				component('top-right-dot', box(52, 0, 74, 22), { fill: '#006633' }),
				component('left-red-stack', box(18, 34, 40, 90), { fill: '#993300' }),
				component('right-red-stack', box(52, 34, 74, 90), { fill: '#993300' }),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'd-6',
				parts: {},
			}),
		});

		const dotGroup = findGroup(alignmentMap, 'dot');
		const dotMappings = alignmentMap.sourcePartMappings
			.filter((mapping) => mapping.role === 'dot');

		expect(dotGroup.matchStatus).toBe('ambiguous-count');
		expect(dotMappings.length).toBe(4);
		expect(dotMappings.every((mapping) => mapping.referencePartIds.length === 1)).toBeTrue();
		expect(dotMappings.flatMap((mapping) => mapping.sourceComponentIds).sort()).toEqual([
			'left-red-stack',
			'right-red-stack',
			'top-left-dot',
			'top-right-dot',
		]);
	});

	it('treats each normalized source shape as one repeated dot unit', function() {
		const referenceParts = {
			'dot.1': referencePart('dot', 'artwork', ['ref-dot-1'], box(18, 0, 40, 22)),
			'dot.2': referencePart('dot', 'artwork', ['ref-dot-2'], box(52, 0, 74, 22)),
			'dot.3': referencePart('dot', 'artwork', ['ref-dot-3'], box(18, 34, 40, 56)),
			'dot.4': referencePart('dot', 'artwork', ['ref-dot-4'], box(52, 34, 74, 56)),
			'dot.5': referencePart('dot', 'artwork', ['ref-dot-5'], box(18, 68, 40, 90)),
			'dot.6': referencePart('dot', 'artwork', ['ref-dot-6'], box(52, 68, 74, 90)),
		};
		const referenceComponents = Object.entries(referenceParts)
			.map(([partId, part]) => referenceComponent(part.componentIds[0], part.targetBounds, {
				partIds: [partId],
				semanticRoles: ['dot'],
			}));
		const normalizedComponents = [
			component('top-left-dot', box(18, 0, 40, 22), { fill: '#006633' }),
			component('top-right-dot', box(52, 0, 74, 22), { fill: '#006633' }),
			component('middle-left-dot', box(18, 34, 40, 56), {
				fill: '#993300',
				componentLevel: 'subcomponent',
				splitStrategy: 'compound-path-band',
			}),
			component('bottom-left-dot', box(18, 68, 40, 90), {
				fill: '#993300',
				componentLevel: 'subcomponent',
				splitStrategy: 'compound-path-band',
			}),
			component('middle-right-dot', box(52, 34, 74, 56), {
				fill: '#993300',
				componentLevel: 'subcomponent',
				splitStrategy: 'compound-path-band',
			}),
			component('bottom-right-dot', box(52, 68, 74, 90), {
				fill: '#993300',
				componentLevel: 'subcomponent',
				splitStrategy: 'compound-path-band',
			}),
		];
		const alignmentMap = alignTestFace({
			faceKey: 'd-6',
			referenceParts,
			referenceComponents,
			normalizedComponents,
			sourceShapes: [
				sourceShape('shape.top-left', ['top-left-dot'], box(18, 0, 40, 22)),
				sourceShape('shape.top-right', ['top-right-dot'], box(52, 0, 74, 22)),
				sourceShape('shape.middle-left', ['middle-left-dot'], box(18, 34, 40, 56)),
				sourceShape('shape.middle-right', ['middle-right-dot'], box(52, 34, 74, 56)),
				sourceShape('shape.bottom-left', ['bottom-left-dot'], box(18, 68, 40, 90)),
				sourceShape('shape.bottom-right', ['bottom-right-dot'], box(52, 68, 74, 90)),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'd-6',
				parts: {},
			}),
		});

		const dotGroup = findGroup(alignmentMap, 'dot');
		const dotMappings = alignmentMap.sourcePartMappings
			.filter((mapping) => mapping.role === 'dot');

		expect(dotGroup.matchStatus).toBe('matched');
		expect(dotMappings.length).toBe(6);
		expect(dotMappings.map((mapping) => mapping.sourceComponentIds).flat().sort()).toEqual([
			'bottom-left-dot',
			'bottom-right-dot',
			'middle-left-dot',
			'middle-right-dot',
			'top-left-dot',
			'top-right-dot',
		]);
		expect(dotMappings.map((mapping) => mapping.referencePartIds[0])).toEqual([
			'dot.1',
			'dot.2',
			'dot.3',
			'dot.4',
			'dot.5',
			'dot.6',
		]);
	});

	it('does not split a multi-component source shape during repeated dot alignment', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'd-6',
			referenceParts: {
				'dot.1': referencePart('dot', 'artwork', ['ref-dot-1'], box(18, 0, 40, 22)),
				'dot.2': referencePart('dot', 'artwork', ['ref-dot-2'], box(52, 0, 74, 22)),
			},
			referenceComponents: [
				referenceComponent('ref-dot-1', box(18, 0, 40, 22), { partIds: ['dot.1'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-2', box(52, 0, 74, 22), { partIds: ['dot.2'], semanticRoles: ['dot'] }),
			],
			normalizedComponents: [
				component('left-dot', box(18, 0, 40, 22), {
					fill: '#993300',
					componentLevel: 'subcomponent',
					splitStrategy: 'compound-path-band',
				}),
				component('right-dot', box(52, 0, 74, 22), {
					fill: '#993300',
					componentLevel: 'subcomponent',
					splitStrategy: 'compound-path-band',
				}),
			],
			sourceShapes: [
				sourceShape('shape.combined-dots', ['left-dot', 'right-dot'], box(18, 0, 74, 22), {
					splitStrategies: ['compound-path-band'],
				}),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'd-6',
				parts: {},
			}),
		});

		const dotMappings = alignmentMap.sourcePartMappings
			.filter((mapping) => mapping.role === 'dot');

		expect(dotMappings.length).toBe(1);
		expect(dotMappings[0].sourceComponentIds).toEqual(['left-dot', 'right-dot']);
	});

	it('keeps exact center-overlap dot layers together when slanted positions disagree with the reference', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'd-3',
			referenceParts: {
				'dot.1': referencePart('dot', 'artwork', ['ref-dot-1'], box(55, 0, 90, 35)),
				'dot.2': referencePart('dot', 'artwork', ['ref-dot-2'], box(28, 45, 63, 80)),
				'dot.3': referencePart('dot', 'artwork', ['ref-dot-3'], box(0, 90, 35, 125)),
			},
			referenceComponents: [
				referenceComponent('ref-dot-1', box(55, 0, 90, 35), { partIds: ['dot.1'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-2', box(28, 45, 63, 80), { partIds: ['dot.2'], semanticRoles: ['dot'] }),
				referenceComponent('ref-dot-3', box(0, 90, 35, 125), { partIds: ['dot.3'], semanticRoles: ['dot'] }),
			],
			normalizedComponents: [
				component('black.outer', box(0, 0, 25, 25), { fill: '#000000' }),
				component('green.outer', box(31, 62, 56, 87), { fill: '#069200' }),
				component('red.outer', box(15, 31, 40, 56), { fill: '#c20000' }),
				component('black.inner', box(2.1, 2.1, 22.9, 22.9), { fill: '#9a9a9a' }),
				component('red.inner', box(17.1, 33.1, 37.9, 53.9), { fill: '#ff7777' }),
				component('green.inner', box(33.1, 64.1, 53.9, 84.9), { fill: '#5be335' }),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'd-3',
				parts: {},
			}),
		});

		const dotMappings = alignmentMap.sourcePartMappings
			.filter((mapping) => mapping.role === 'dot');
		const dotSourceGroups = dotMappings
			.map((mapping) => mapping.sourceComponentIds.sort())
			.sort((left, right) => left[0].localeCompare(right[0]));

		expect(dotSourceGroups).toEqual([
			['black.inner', 'black.outer'],
			['green.inner', 'green.outer'],
			['red.inner', 'red.outer'],
		]);
	});

	it('uses center-overlap as a soft joining weight when completing repeated parts', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'd-2',
			referenceParts: {
				'dot.1': referencePart('dot', 'artwork', ['ref-top'], box(0, 0, 24, 24)),
				'dot.2': referencePart('dot', 'artwork', ['ref-bottom'], box(0, 50, 24, 74)),
			},
			referenceComponents: [
				referenceComponent('ref-top', box(0, 0, 24, 24), { partIds: ['dot.1'], semanticRoles: ['dot'] }),
				referenceComponent('ref-bottom', box(0, 50, 24, 74), { partIds: ['dot.2'], semanticRoles: ['dot'] }),
			],
			normalizedComponents: [
				component('top.outer', box(0, 0, 24, 24), { fill: '#069200' }),
				component('bottom.outer', box(0, 50, 24, 74), { fill: '#069200' }),
				component('top.inner', box(6, 6, 18, 18), { fill: '#5be335' }),
				component('bottom.inner', box(6, 56, 18, 68), { fill: '#5be335' }),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'd-2',
				parts: {},
			}),
		});

		const dotMappings = alignmentMap.sourcePartMappings
			.filter((mapping) => mapping.role === 'dot');

		expect(dotMappings.map((mapping) => mapping.sourceComponentIds.sort())).toEqual([
			['top.inner', 'top.outer'],
			['bottom.inner', 'bottom.outer'],
		]);
	});

	it('keeps authored layered source subgroups together for repeated parts', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'b-2',
			referenceParts: {
				'bamboo.1': referencePart('bamboo-stick', 'artwork', ['ref-top'], box(40, 10, 60, 62)),
				'bamboo.2': referencePart('bamboo-stick', 'artwork', ['ref-bottom'], box(40, 70, 60, 124)),
			},
			referenceComponents: [
				referenceComponent('ref-top', box(40, 10, 60, 62), { partIds: ['bamboo.1'], semanticRoles: ['bamboo-stick'] }),
				referenceComponent('ref-bottom', box(40, 70, 60, 124), { partIds: ['bamboo.2'], semanticRoles: ['bamboo-stick'] }),
			],
			normalizedComponents: [
				component('top.inner', box(98, 15, 109, 44), { fill: '#9a9a9a', parentGroupIds: ['tile', 'top-stick'] }),
				component('top.outer', box(95, 14, 112, 45), { fill: '#000000', parentGroupIds: ['tile', 'top-stick'] }),
				component('bottom.inner', box(98, 55, 109, 84), { fill: '#5be335', parentGroupIds: ['tile', 'bottom-stick'] }),
				component('bottom.outer', box(95, 54, 112, 85), { fill: '#069200', parentGroupIds: ['tile', 'bottom-stick'] }),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'b-2',
				parts: {},
			}),
		});

		const bambooMappings = alignmentMap.sourcePartMappings
			.filter((mapping) => mapping.role === 'bamboo-stick');

		expect(bambooMappings.map((mapping) => mapping.sourceComponentIds.sort())).toEqual([
			['top.inner', 'top.outer'],
			['bottom.inner', 'bottom.outer'],
		]);
	});

	it('keeps repeated transformed source copies together when they share one parent group', function() {
		const alignmentMap = alignTestFace({
			faceKey: 'b-3',
			referenceParts: {
				'bamboo.1': referencePart('bamboo-stick', 'artwork', ['ref-top'], box(40, 10, 60, 62)),
				'bamboo.2': referencePart('bamboo-stick', 'artwork', ['ref-left'], box(12, 70, 32, 124)),
				'bamboo.3': referencePart('bamboo-stick', 'artwork', ['ref-right'], box(66, 70, 86, 124)),
			},
			referenceComponents: [
				referenceComponent('ref-top', box(40, 10, 60, 62), { partIds: ['bamboo.1'], semanticRoles: ['bamboo-stick'] }),
				referenceComponent('ref-left', box(12, 70, 32, 124), { partIds: ['bamboo.2'], semanticRoles: ['bamboo-stick'] }),
				referenceComponent('ref-right', box(66, 70, 86, 124), { partIds: ['bamboo.3'], semanticRoles: ['bamboo-stick'] }),
			],
			normalizedComponents: [
				component('left.inner', box(12, 55, 23, 84), { fill: '#5be335', parentGroupIds: ['tile', 'stick-copies'], transform: transform(1, 0, 0, 1, 12, 40) }),
				component('left.outer', box(9, 54, 25, 85), { fill: '#069200', parentGroupIds: ['tile', 'stick-copies'], transform: transform(1, 0, 0, 1, 12, 40) }),
				component('right.inner', box(72, 55, 83, 84), { fill: '#5be335', parentGroupIds: ['tile', 'stick-copies'], transform: transform(1, 0, 0, 1, 72, 40) }),
				component('right.outer', box(69, 54, 85, 85), { fill: '#069200', parentGroupIds: ['tile', 'stick-copies'], transform: transform(1, 0, 0, 1, 72, 40) }),
				component('top.inner', box(42, 15, 53, 44), { fill: '#5be335', parentGroupIds: ['tile', 'stick-copies'], transform: transform(1, 0, 0, 1, 42, 0) }),
				component('top.outer', box(39, 14, 55, 45), { fill: '#069200', parentGroupIds: ['tile', 'stick-copies'], transform: transform(1, 0, 0, 1, 42, 0) }),
			],
			optionalAssignment: optionalAssignment({
				faceKey: 'b-3',
				parts: {},
			}),
		});

		const bambooMappings = alignmentMap.sourcePartMappings
			.filter((mapping) => mapping.role === 'bamboo-stick');

		expect(bambooMappings.map((mapping) => mapping.sourceComponentIds.sort())).toEqual([
			['top.inner', 'top.outer'],
			['left.inner', 'left.outer'],
			['right.inner', 'right.outer'],
		]);
	});
});

function alignTestFace({
	faceKey,
	referenceParts = defaultReferenceParts(),
	referenceComponents = defaultReferenceComponents(),
	normalizedComponents,
	sourceShapes = [],
	optionalAssignment,
	semanticMap = null,
	faceMetadata = null,
}) {
	const effectiveSemanticMap = semanticMap || semanticMapFromOptionalAssignment(optionalAssignment);
	const referenceStructure = {
		referenceSet: {
			referenceSetId: 'test-reference',
			coordinateSpace: {
				preparedViewBox: [0, 0, 94, 136],
			},
		},
		faces: {
			[faceKey]: {
				image: {
					width: 100,
					height: 140,
				},
				parts: referenceParts,
				components: referenceComponents,
			},
		},
	};

	return alignFace({
		tilesetId: 'wiki',
		faceKey,
		generatedOn: '2026-05-03T12:00:00.000Z',
		referenceStructure,
		referenceFace: referenceStructure.faces[faceKey],
		referenceStructurePath: path.resolve('test-root/reference-structure.json'),
		normalizedFace: {
			sourceFile: `scripts/data/3d-assets/sprite-source-svgs/wiki/${faceKey}.svg`,
			alignmentBounds: box(0, 0, 100, 140),
			alignmentComponentIds: normalizedComponents.map((item) => item.componentId),
			components: normalizedComponents,
			sourceShapes,
		},
		normalizedPath: path.resolve('test-root/normalized-components', `${faceKey}.json`),
		optionalAssignment,
		optionalAssignmentPath: optionalAssignment
			? path.resolve('test-root/optional-parts', `${faceKey}.json`)
			: null,
		semanticMap: effectiveSemanticMap,
		semanticMapPath: effectiveSemanticMap
			? path.resolve('test-root/semantic-map', `${faceKey}.json`)
			: null,
		faceMetadata,
	});
}

function defaultReferenceParts() {
	return {
		label: referencePart('flower-label', 'label', ['ref-label'], box(5, 5, 12, 18)),
		glyph: referencePart('flower-character', 'glyph', ['ref-glyph'], box(76, 5, 92, 28)),
		mainArtwork: referencePart('main-artwork', 'artwork', ['ref-art'], box(30, 40, 70, 110)),
	};
}

function defaultReferenceComponents() {
	return [
		referenceComponent('ref-label', box(5, 5, 12, 18), {
			partIds: ['label'],
			semanticRoles: ['flower-label'],
		}),
		referenceComponent('ref-glyph', box(76, 5, 92, 28), {
			partIds: ['glyph'],
			semanticRoles: ['flower-character'],
		}),
		referenceComponent('ref-art', box(30, 40, 70, 110), {
			partIds: ['mainArtwork'],
			semanticRoles: ['main-artwork'],
		}),
	];
}

function referencePart(role, contentKind, componentIds, targetBounds) {
	return {
		partId: componentIds[0],
		role,
		contentKind,
		componentIds,
		targetBounds,
	};
}

function referenceComponent(componentId, bounds, overrides = {}) {
	return {
		componentId,
		bounds,
		center: centerOf(bounds),
		dominantColor: '#111',
		partIds: [],
		globalPartIds: [],
		semanticRoles: [],
		...overrides,
	};
}

function component(componentId, bounds, overrides = {}) {
	return {
		componentId,
		bounds,
		center: centerOf(bounds),
		area: bounds.area,
		fill: '#111',
		classification: {
			tileLayerCandidate: false,
			negativeSpaceCandidate: false,
		},
		...overrides,
	};
}

function sourceShape(shapeId, componentIds, bounds, overrides = {}) {
	return {
		shapeId,
		componentIds,
		bounds,
		center: centerOf(bounds),
		area: bounds.area,
		...overrides,
	};
}

function layeredDot(componentId, left, top) {
	return [
		component(`${componentId}.outer`, box(left, top, left + 21, top + 21), { fill: '#069200' }),
		component(`${componentId}.inner`, box(left + 2, top + 2, left + 19, top + 19), { fill: '#5be335' }),
	];
}

function optionalAssignment({ faceKey, parts, outputParts = {} }) {
	const optionalParts = {};
	const componentReservations = [];

	for (const [partId, componentIds] of Object.entries(parts)) {
		optionalParts[partId] = {
			partId,
			expected: componentIds.length > 0,
			sourceState: componentIds.length > 0 ? 'candidate-found' : 'source-absent',
			suggestedComponentIds: componentIds,
		};

		if (componentIds.length > 0) {
			componentReservations.push({
				partId,
				componentIds,
				reviewStatus: 'inferred',
			});
		}
	}

	return {
		schemaVersion: 1,
		faceKey,
		status: 'ready',
		generatedOn: '2026-05-03T12:00:00.000Z',
		optionalParts,
		componentReservations,
		outputOptions: {
			parts: outputParts,
		},
	};
}

function semanticMapFromOptionalAssignment(optionalAssignment) {
	if (!optionalAssignment) {
		return null;
	}

	return semanticMap(Object.fromEntries((optionalAssignment.componentReservations || [])
		.flatMap((reservation) => (reservation.componentIds || [])
			.map((componentId) => [componentId, {
				partId: reservation.partId,
				strength: reservation.strength || 'tentative',
				reviewStatus: reservation.reviewStatus || 'inferred',
			}]))));
}

function semanticMap(sourceSemanticBindings) {
	return {
		schemaVersion: 1,
		status: 'draft',
		reviewStatus: 'draft',
		bindings: sourceSemanticBindings,
		assignments: Object.entries(sourceSemanticBindings)
			.filter(([, binding]) => binding.partId)
			.map(([componentId, binding]) => ({
			assignmentId: `assign.test.${binding.partId}`,
			referencePartId: binding.partId,
			sourceComponentIds: [componentId],
			assignmentType: 'source',
			reviewStatus: 'draft',
		})),
		diagnostics: [],
	};
}

function strongBinding(partId) {
	return {
		partId,
		source: 'manual',
		strength: 'strong',
		reviewStatus: 'reviewed',
	};
}

function transform(a, b, c, d, e, f) {
	return { a, b, c, d, e, f };
}

function findGroup(alignmentMap, groupId) {
	return alignmentMap.alignmentGroups.find((group) => group.groupId === groupId);
}

function centerOf(bounds) {
	return {
		x: bounds.left + (bounds.width / 2),
		y: bounds.top + (bounds.height / 2),
	};
}

function box(left, top, right, bottom) {
	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
		area: (right - left) * (bottom - top),
	};
}
