import path from 'path';
import { OptionalPartAssignmentRunner } from '../OptionalPartAssignmentRunner.js';

describe('optional part assignment domain behavior', function() {
	it('treats missing optional candidates as review context without blocking acceptance', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-1',
			components: [
				component('body-art', box(25, 55, 90, 130)),
			],
		}));

		expect(artifact.status).toBe('ready');
		expect(artifact.optionalParts.label.expected).toBe(true);
		expect(artifact.optionalParts.label.sourceState).toBe('needs-review');
		expect(artifact.optionalParts.label.suggestedComponentIds).toEqual([]);
		expect(artifact.bindingSuggestions).toEqual([]);
		expect(artifact.diagnostics).toEqual([jasmine.objectContaining({
			level: 'info',
			code: 'no-optional-part-candidate',
			partId: 'label',
		})]);
	});

	it('treats absent optional parts as satisfied without bindings', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-1',
			components: [
				component('label-candidate', box(4, 4, 14, 20)),
			],
			bulkOptions: {
				families: {
					bamboo: {
						label: { searchSource: false },
					},
				},
			},
		}));

		expect(artifact.status).toBe('ready');
		expect(artifact.optionalParts.label.expected).toBe(false);
		expect(artifact.optionalParts.label.sourceState).toBe('source-absent');
		expect(artifact.optionalParts.label.candidates).toEqual([]);
		expect(artifact.bindingSuggestions).toEqual([]);
		expect(artifact.diagnostics).toEqual([]);
		expect(artifact.metadataSeed.glyphLayout.label).toEqual(jasmine.objectContaining({
			sourceCorner: 'topLeft',
		}));
	});

	it('defaults final output on when source artwork is absent', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-1',
			components: [],
			bulkOptions: {
				families: {
					bamboo: {
						label: { searchSource: false },
					},
				},
			},
		}));

		expect(artifact.optionalParts.label.sourceState).toBe('source-absent');
		expect(artifact.metadataSeed.glyphLayout.label).toEqual(jasmine.objectContaining({
			sourceCorner: 'topLeft',
		}));
	});

	it('searches character suit labels by default from the configured hint', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'c-2',
			components: [
				component('body-stroke', box(30, 45, 70, 120)),
				component('top-left-stroke', box(4, 4, 38, 14), { fill: '#000000' }),
				component('top-label', box(84, 4, 98, 24), { fill: '#c20000' }),
			],
		}));

		expect(artifact.status).toBe('ready');
		expect(artifact.optionalParts.label.expected).toBe(true);
		expect(artifact.optionalParts.label.sourceState).toBe('candidate-found');
		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['top-left-stroke']);
		expect(artifact.optionalParts.label.hint.region).toBe('top-left');
		expect(artifact.bindingSuggestions).toContain(jasmine.objectContaining({
			partId: 'label',
			componentIds: ['top-left-stroke'],
		}));
	});

	it('lets bulk settings disable source labels on character suit faces without changing generated label output', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'c-2',
			components: [
				component('body-stroke', box(30, 45, 70, 120)),
				component('top-label', box(4, 4, 18, 24)),
			],
			bulkOptions: {
				families: {
					character: {
						label: { searchSource: false },
					},
				},
			},
		}));

		expect(artifact.status).toBe('ready');
		expect(artifact.optionalParts.label.expected).toBe(false);
		expect(artifact.optionalParts.label.sourceState).toBe('source-absent');
		expect(artifact.optionalParts.label.candidates).toEqual([]);
		expect(artifact.optionalParts.label.suggestedComponentIds).toEqual([]);
		expect(artifact.bindingSuggestions).toEqual([]);
	});

	it('uses bulk hint positions to score optional source labels', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-2',
			components: [
				component('top-left-stroke', box(4, 4, 38, 14), { fill: '#000000' }),
				component('top-right-label', box(84, 4, 98, 24), { fill: '#c20000' }),
			],
			bulkOptions: {
				families: {
					bamboo: {
						label: {
							searchSource: true,
							region: 'top-right',
						},
					},
				},
			},
		}));

		expect(artifact.optionalParts.label.hint.region).toBe('top-right');
		expect(artifact.optionalParts.label.sourceState).toBe('candidate-found');
		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['top-right-label']);
	});

	it('lets face-level optional search settings override family settings', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-2',
			components: [
				component('top-left-label', box(4, 4, 18, 24), { fill: '#c20000' }),
			],
			bulkOptions: {
				families: {
					bamboo: {
						label: {
							searchSource: false,
						},
					},
				},
				faces: {
					'b-2': {
						label: {
							searchSource: true,
							region: 'top-left',
						},
					},
				},
			},
		}));

		expect(artifact.optionalParts.label.expected).toBe(true);
		expect(artifact.optionalParts.label.hint.region).toBe('top-left');
		expect(artifact.optionalParts.label.sourceState).toBe('candidate-found');
		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['top-left-label']);
	});

	it('uses flower pair layout to assign label and character ownership', function() {
		const runner = makeRunner();
		const leftLabelRightCharacter = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'flower-1',
			components: [
				component('left', box(4, 4, 14, 20), { sourceIndex: 0 }),
				component('right', box(72, 4, 98, 34), { sourceIndex: 1 }),
			],
			bulkOptions: {
				families: {
					flower: {
						layout: 'label-left-character-right',
					},
				},
			},
		}));
		const rightLabelLeftCharacter = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'flower-1',
			components: [
				component('left', box(4, 4, 14, 20), { sourceIndex: 0 }),
				component('right', box(72, 4, 98, 34), { sourceIndex: 1 }),
			],
			bulkOptions: {
				families: {
					flower: {
						layout: 'label-right-character-left',
					},
				},
			},
		}));

		expect(leftLabelRightCharacter.optionalParts.label.hint.region).toBe('top-left');
		expect(leftLabelRightCharacter.optionalParts.glyph.hint.region).toBe('top-right');
		expect(bindingSuggestionForPart(leftLabelRightCharacter, 'label').componentIds).toEqual(['left']);
		expect(bindingSuggestionForPart(leftLabelRightCharacter, 'glyph').componentIds).toEqual(['right']);
		expect(rightLabelLeftCharacter.optionalParts.label.hint.region).toBe('top-right');
		expect(rightLabelLeftCharacter.optionalParts.glyph.hint.region).toBe('top-left');
		expect(bindingSuggestionForPart(rightLabelLeftCharacter, 'label').componentIds).toEqual(['right']);
		expect(bindingSuggestionForPart(rightLabelLeftCharacter, 'glyph').componentIds).toEqual(['left']);
	});

	it('creates reservations that alignment can consume before generic artwork matching', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-1',
			components: [
				component('label-candidate', box(4, 4, 14, 20)),
			],
		}));

		expect(artifact.bindingSuggestions).toEqual([jasmine.objectContaining({
			partId: 'label',
			componentIds: ['label-candidate'],
			bounds: box(4, 4, 14, 20),
			reviewStatus: 'inferred',
		})]);
	});

	it('prefers source SVG text components over same-size artwork fragments for labels', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-1',
			components: [
				component('artwork-fragment', box(15, 48, 38, 62), {
					sourceIndex: 8,
					fill: '#680060',
				}),
				component('source-text-label', box(72, 8, 84, 24), {
					sourceIndex: 1,
					fill: 'black',
					fontFamily: 'Century Schoolbook L',
					fontSize: 18,
					textValue: '1',
				}),
			],
		}));

		expect(artifact.optionalParts.label.sourceState).toBe('candidate-found');
		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['source-text-label']);
		expect(artifact.optionalParts.label.candidates[0]).toEqual(jasmine.objectContaining({
			componentIds: ['source-text-label'],
			textComponent: true,
			textLabelMatch: true,
			textValues: ['1'],
			reasons: jasmine.arrayContaining(['svg-text-label-match']),
		}));
	});

	it('lets matching SVG text override the initial location weighting', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-1',
			components: [
				component('top-right-label-shape', box(84, 4, 98, 24), {
					sourceIndex: 4,
					fill: '#c20000',
				}),
				component('top-right-text', box(84, 4, 98, 24), {
					sourceIndex: 1,
					fill: 'black',
					fontFamily: 'Century Schoolbook L',
					fontSize: 18,
					textValue: '1',
				}),
			],
		}));

		expect(artifact.optionalParts.label.sourceState).toBe('candidate-found');
		expect(artifact.optionalParts.label.hint.region).toBe('top-left');
		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['top-right-text']);
		expect(artifact.optionalParts.label.candidates[0]).toEqual(jasmine.objectContaining({
			componentIds: ['top-right-text'],
			textLabelMatch: true,
			reasons: jasmine.arrayContaining(['svg-text-label-match']),
		}));
	});

	it('prioritizes matching text labels when no expected corner candidate matches the hint', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-1',
			components: [
				component('top-right-label-shape', box(84, 4, 98, 24), {
					sourceIndex: 4,
					fill: '#c20000',
				}),
				component('center-text', box(44, 48, 58, 68), {
					sourceIndex: 1,
					fill: 'black',
					fontFamily: 'Century Schoolbook L',
					fontSize: 18,
					textValue: '1',
				}),
			],
		}));

		expect(artifact.optionalParts.label.sourceState).toBe('candidate-found');
		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['center-text']);
		expect(artifact.optionalParts.label.candidates[0]).toEqual(jasmine.objectContaining({
			componentIds: ['center-text'],
			positionPriority: 0,
			textLabelMatch: true,
			reasons: jasmine.arrayContaining(['svg-text-label-match']),
		}));
	});

	it('does not treat non-matching SVG text as label evidence', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-1',
			components: [
				component('top-left-label-shape', box(4, 4, 18, 24), {
					sourceIndex: 4,
					fill: '#c20000',
				}),
				component('top-right-word-text', box(84, 4, 98, 24), {
					sourceIndex: 1,
					fill: 'black',
					fontFamily: 'Century Schoolbook L',
					fontSize: 18,
					textValue: 'PLUM',
				}),
			],
		}));

		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['top-left-label-shape']);
		const wordCandidate = artifact.optionalParts.label.candidates.find((candidate) => candidate.componentIds[0] === 'top-right-word-text');

		expect(wordCandidate).toEqual(jasmine.objectContaining({
			textComponent: true,
			textLabelMatch: false,
			textValues: ['PLUM'],
		}));
		expect(wordCandidate.reasons).not.toContain('svg-text-label-match');
	});

	it('searches dragon labels by default', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'dragon-r',
			components: [
				component('dragon-art', box(20, 20, 80, 120)),
				component('dragon-label', box(84, 4, 94, 18)),
			],
		}));

		expect(artifact.status).toBe('ready');
		expect(artifact.optionalParts.label).toEqual(jasmine.objectContaining({
			role: 'dragon-label',
			expected: true,
			sourceState: 'candidate-found',
		}));
		expect(artifact.optionalParts.label.hint.region).toBe('top-right');
		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['dragon-label']);
		expect(artifact.bindingSuggestions).toEqual([jasmine.objectContaining({
			partId: 'label',
			componentIds: ['dragon-label'],
		})]);
		expect(artifact.diagnostics).toEqual([]);
	});

	it('allows grouped split source elements to become optional glyph candidates', function() {
		const runner = makeRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'flower-1',
			components: [
				component('glyph-left', box(4, 4, 14, 24), {
					sourceIndex: 0,
					parentComponentId: 'src.flower-1.0001',
					componentLevel: 'subcomponent',
				}),
				component('glyph-right', box(16, 4, 26, 24), {
					sourceIndex: 0,
					parentComponentId: 'src.flower-1.0001',
					componentLevel: 'subcomponent',
				}),
				component('label', box(72, 4, 90, 24), {
					sourceIndex: 1,
				}),
			],
		}));
		const glyphCandidates = artifact.optionalParts.glyph.candidates;
		const groupCandidate = glyphCandidates.find((candidate) => candidate.unitKind === 'source-element-group');

		expect(groupCandidate).toEqual(jasmine.objectContaining({
			componentIds: ['glyph-left', 'glyph-right'],
			unitKind: 'source-element-group',
		}));
		expect(bindingSuggestionForPart(artifact, 'glyph').componentIds).toEqual(['glyph-left', 'glyph-right']);
		expect(artifact.bindingSuggestions).toContain(jasmine.objectContaining({
			partId: 'glyph',
			componentIds: ['glyph-left', 'glyph-right'],
		}));
	});
});

function makeRunner() {
	return new OptionalPartAssignmentRunner({
		rootDir: path.resolve('test-root'),
		clock: () => '2026-05-03T12:00:00.000Z',
	});
}

function bindingSuggestionForPart(artifact, partId) {
	return artifact.bindingSuggestions.find((suggestion) => suggestion.partId === partId);
}

function makeArtifactInput({ faceKey, components, bulkOptions = null, alignmentBounds = box(0, 0, 100, 140) }) {
	const rootDir = path.resolve('test-root');

	return {
		tilesetId: 'wiki',
		faceKey,
		generatedOn: '2026-05-03T12:00:00.000Z',
		normalizedPath: path.resolve(rootDir, 'normalized-components', `${faceKey}.json`),
		sourceFile: `scripts/data/3d-assets/sprite-source-svgs/wiki/${faceKey}.svg`,
		normalized: {
			sourceFile: `scripts/data/3d-assets/sprite-source-svgs/wiki/${faceKey}.svg`,
			alignmentComponentIds: components.map((item) => item.componentId),
			alignmentBounds,
			components,
		},
		bulkOptions,
	};
}

function component(componentId, bounds, overrides = {}) {
	return {
		componentId,
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		area: bounds.area,
		sourceIndex: 0,
		sourceElementIndex: 0,
		componentLevel: 'element',
		className: null,
		fill: '#111',
		parentComponentId: null,
		classification: {
			tileLayerCandidate: false,
			negativeSpaceCandidate: false,
		},
		...overrides,
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
