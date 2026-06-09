import path from 'path';
import { BASE_OUTPUT, BASE_REFERENCE } from '../PipelineModel.js';
import {
	FinalRenderingCompositionRunner,
	buildAddOptionalSvg,
	buildColorStep,
	buildFinalRenderingCompositionArtifact,
	buildLayoutStep,
} from '../FinalRenderingCompositionRunner.js';

describe('FinalRenderingCompositionRunner', function() {
	it('composes optional source and omitted render decisions', function() {
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					suits: {
						flower: {
							suitId: 'flower',
							parts: {
								glyph: {
									outputPresent: false,
									source: 'review',
								},
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/flower-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-1',
				family: 'flower',
				optionalParts: {
					label: optionalPart('label', { sourceState: 'candidate-found' }),
					glyph: optionalPart('glyph', { contentKind: 'glyph', role: 'flower-character' }),
					badge: optionalPart('badge', { sourceState: 'source-absent' }),
				},
			}),
			semanticMapPath: 'semantic-map/flower-1.json',
			semanticMap: semanticMap({
				assignments: [
					assignment('label', { sourceComponentIds: ['src.flower-1.0001'] }),
				],
				bindings: {
					'src.flower-1.0001': {
						partId: 'label',
						strength: 'accepted',
					},
				},
			}),
		});

		expect(artifact.status).toBe('ready');
		expect(artifact.steps.addOptional.parts.label).toEqual(jasmine.objectContaining({
			renderKind: 'source',
			outputPresent: true,
			sourceComponentIds: ['src.flower-1.0001'],
		}));
		expect(artifact.steps.addOptional.parts.glyph).toEqual(jasmine.objectContaining({
			renderKind: 'omit',
			outputPresent: false,
			sourceComponentIds: [],
		}));
		expect(artifact.steps.addOptional.parts.badge).toEqual(jasmine.objectContaining({
			renderKind: 'omit',
			outputPresent: true,
			sourceComponentIds: [],
		}));
		expect(artifact.summary).toEqual(jasmine.objectContaining({
			optionalPartCount: 3,
			sourceRenderCount: 1,
			generatedRenderCount: 0,
			omittedRenderCount: 2,
			unresolvedRenderCount: 0,
		}));
	});

	it('applies tileset face render options after suit defaults', function() {
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					suits: {
						flower: {
							suitId: 'flower',
							parts: {
								glyph: {
									outputPresent: true,
									source: 'source-preferred',
								},
							},
						},
					},
					faces: {
						'flower-1': {
							faceKey: 'flower-1',
							suitId: 'flower',
							parts: {
								glyph: {
									outputPresent: false,
									source: 'review-override',
								},
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/flower-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-1',
				family: 'flower',
				optionalParts: {
					glyph: optionalPart('glyph', {
						contentKind: 'glyph',
						role: 'flower-character',
						sourceState: 'candidate-found',
					}),
				},
			}),
			semanticMapPath: 'semantic-map/flower-1.json',
			semanticMap: semanticMap({
				assignments: [
					assignment('glyph', { sourceComponentIds: ['src.flower-1.glyph'] }),
				],
				bindings: {
					'src.flower-1.glyph': {
						partId: 'glyph',
						strength: 'accepted',
					},
				},
			}),
		});

		expect(artifact.inputs.outputOptions.source).toBe('face');
		expect(artifact.steps.addOptional.parts.glyph).toEqual(jasmine.objectContaining({
			renderKind: 'omit',
			outputPresent: false,
			sourceComponentIds: ['src.flower-1.glyph'],
		}));
	});

	it('applies tileset suit render options after older optional assignment options', function() {
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'flower-2',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					suits: {
						flower: {
							suitId: 'flower',
							parts: {
								glyph: {
									outputPresent: false,
									source: 'review',
								},
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/flower-2.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-2',
				family: 'flower',
				optionalParts: {
					glyph: optionalPart('glyph', {
						contentKind: 'glyph',
						role: 'flower-character',
						sourceState: 'candidate-found',
					}),
				},
				outputOptions: {
					suitId: 'flower',
					parts: {
						glyph: {
							partId: 'glyph',
							contentKind: 'glyph',
							role: 'flower-character',
							outputPresent: true,
							source: 'source-preferred',
						},
					},
				},
			}),
			semanticMapPath: 'semantic-map/flower-2.json',
			semanticMap: semanticMap({
				assignments: [
					assignment('glyph', { sourceComponentIds: ['src.flower-2.glyph'] }),
				],
				bindings: {
					'src.flower-2.glyph': {
						partId: 'glyph',
						strength: 'accepted',
					},
				},
			}),
		});

		expect(artifact.steps.addOptional.parts.glyph).toEqual(jasmine.objectContaining({
			renderKind: 'omit',
			outputPresent: false,
			sourceComponentIds: ['src.flower-2.glyph'],
		}));
	});

	it('renders source optional reservations when no semantic part assignment exists', function() {
		const map = semanticMap({
			assignments: [
				assignment('mainArtwork', {
					assignmentId: 'assign.dragon-r.mainArtwork',
					sourceComponentIds: ['src.dragon-r.body'],
					alignmentCandidateId: 'align.mainArtwork',
					contentKind: 'artwork',
					role: 'dragon-artwork',
				}),
			],
			bindings: {
				'src.dragon-r.label': {
					partId: 'label',
					strength: 'tentative',
				},
			},
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'traditional',
			faceKey: 'dragon-r',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					suits: {
						dragon: {
							suitId: 'dragon',
							parts: {
								label: {
									outputPresent: true,
									source: 'default-on',
									contentKind: 'label',
									role: 'dragon-label',
								},
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/dragon-r.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'dragon-r',
				family: 'dragon',
				optionalParts: {
					label: optionalPart('label', {
						sourceState: 'candidate-found',
						role: 'dragon-label',
						suggestedComponentIds: ['src.dragon-r.label'],
					}),
				},
				outputOptions: {
					suitId: 'dragon',
					parts: {
						label: {
							partId: 'label',
							contentKind: 'label',
							role: 'dragon-label',
							outputPresent: true,
							source: 'default-on',
						},
					},
				},
			}),
			semanticMapPath: 'semantic-map/dragon-r.json',
			semanticMap: map,
		});
		const normalized = normalizedArtifact('dragon-r', [
			normalizedComponent('src.dragon-r.body', 'M10 10h40v80h-40z', {
				bounds: box(10, 10, 50, 90),
			}),
			normalizedComponent('src.dragon-r.label', 'M48 8h8v12h-8z', {
				bounds: box(48, 8, 56, 20),
				fill: '#c20000',
			}),
		]);
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalized,
			alignmentMap: alignmentMap([
				alignmentCandidate('align.mainArtwork', {
					matrix: [2, 0, 0, 2, 1, 1],
					sourceComponentIds: ['src.dragon-r.body'],
				}),
			]),
			semanticMap: map,
			referenceStructure: referenceStructure('dragon-r', {
				mainArtwork: {
					partId: 'mainArtwork',
					role: 'dragon-artwork',
					targetBounds: box(10, 20, 70, 110),
				},
			}),
		});

		artifact.steps.layout = layout.step;
		const color = buildColorStep({
			artifact,
			normalizedComponents: normalized,
			alignmentMap: alignmentMap([
				alignmentCandidate('align.mainArtwork', {
					matrix: [2, 0, 0, 2, 1, 1],
					sourceComponentIds: ['src.dragon-r.body'],
				}),
			]),
			semanticMap: map,
			referenceStructure: referenceStructure('dragon-r', {
				mainArtwork: {
					partId: 'mainArtwork',
					role: 'dragon-artwork',
					targetBounds: box(10, 20, 70, 110),
				},
			}),
		});

		expect(artifact.steps.addOptional.parts.label).toEqual(jasmine.objectContaining({
			renderKind: 'source',
			sourceComponentIds: ['src.dragon-r.label'],
		}));
		expect(layout.step.parts.label).toEqual(jasmine.objectContaining({
			renderKind: 'source',
			sourceComponentIds: ['src.dragon-r.label'],
			source: 'alignment-map',
		}));
		expect(layout.svg).toContain('src.dragon-r.label');
		expect(color.step.parts.label).toEqual(jasmine.objectContaining({
			renderKind: 'source',
			sourceComponentIds: ['src.dragon-r.label'],
		}));
		expect(color.svg).toContain('src.dragon-r.label');
	});

	it('forces flower and season labels to house font while glyphs stay source-first', function() {
		const map = semanticMap({
			assignments: [
				assignment('label', {
					assignmentId: 'assign.flower.label',
					role: 'flower-label',
					sourceComponentIds: ['src.flower-1.label'],
					alignmentCandidateId: 'align.label',
				}),
				assignment('glyph', {
					assignmentId: 'assign.flower.glyph',
					contentKind: 'glyph',
					role: 'flower-character',
					sourceComponentIds: ['src.flower-1.glyph'],
					alignmentCandidateId: 'align.glyph',
				}),
			],
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					suits: {
						flower: {
							suitId: 'flower',
							parts: {
								label: {
									outputPresent: true,
									source: 'generated',
									renderMode: 'generated',
									contentKind: 'label',
									role: 'flower-label',
								},
								glyph: {
									outputPresent: true,
									source: 'source-preferred',
									contentKind: 'glyph',
									role: 'flower-character',
								},
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/flower-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-1',
				family: 'flower',
				optionalParts: {
					label: optionalPart('label', { sourceState: 'candidate-found', role: 'flower-label' }),
					glyph: optionalPart('glyph', { sourceState: 'candidate-found', contentKind: 'glyph', role: 'flower-character' }),
				},
			}),
			semanticMapPath: 'semantic-map/flower-1.json',
			semanticMap: map,
		});

		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('flower-1', [
				normalizedComponent('src.flower-1.label', 'M0 0h5v5z'),
				normalizedComponent('src.flower-1.glyph', 'M10 0h5v5z'),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.label', {
					matrix: [1, 0, 0, 1, 1, 1],
					sourceComponentIds: ['src.flower-1.label'],
				}),
				alignmentCandidate('align.glyph', {
					matrix: [1, 0, 0, 1, 2, 2],
					sourceComponentIds: ['src.flower-1.glyph'],
				}),
			]),
			semanticMap: map,
			referenceStructure: referenceStructure('flower-1', {
				label: {
					partId: 'label',
					role: 'flower-label',
					targetBounds: box(4, 4, 14, 24),
				},
				glyph: {
					partId: 'glyph',
					role: 'flower-character',
					targetBounds: box(70, 8, 86, 36),
					text: '梅',
				},
			}),
		});

		expect(artifact.steps.addOptional.parts.label.renderKind).toBe('generated');
		expect(artifact.steps.addOptional.parts.glyph.renderKind).toBe('source');
		expect(layout.step.parts.label.renderKind).toBe('generated');
		expect(layout.step.parts.glyph.renderKind).toBe('source');
		expect(layout.svg).toContain('data-generated-text="1"');
		expect(layout.svg).not.toContain('src.flower-1.label');
		expect(layout.svg).toContain('src.flower-1.glyph');
	});

	it('renders ordinary suit labels as generated output even when a source label was assigned', function() {
		const map = semanticMap({
			assignments: [
				assignment('label', {
					assignmentId: 'assign.b-3.label',
					role: 'suit-label',
					sourceComponentIds: ['src.b-3.label'],
					alignmentCandidateId: 'align.label',
				}),
			],
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'traditional',
			faceKey: 'b-3',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					suits: {
						bamboo: {
							suitId: 'bamboo',
							parts: {
								label: {
									outputPresent: true,
									source: 'generated',
									renderMode: 'generated',
									contentKind: 'label',
									role: 'suit-label',
								},
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/b-3.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'b-3',
				family: 'bamboo',
				value: 3,
				optionalParts: {
					label: optionalPart('label', { sourceState: 'candidate-found', role: 'suit-label' }),
				},
			}),
			semanticMapPath: 'semantic-map/b-3.json',
			semanticMap: map,
		});

		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('b-3', [
				normalizedComponent('src.b-3.label', 'M0 0h5v5z'),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.label', {
					matrix: [1, 0, 0, 1, 1, 1],
					sourceComponentIds: ['src.b-3.label'],
				}),
			]),
			semanticMap: map,
			referenceStructure: referenceStructure('b-3', {
				label: {
					partId: 'label',
					role: 'suit-label',
					targetBounds: box(70, 8, 84, 30),
				},
			}),
		});

		expect(artifact.steps.addOptional.parts.label.renderKind).toBe('generated');
		expect(layout.step.parts.label.renderKind).toBe('generated');
		expect(layout.svg).toContain('data-generated-text="3"');
		expect(layout.svg).toContain('data-generated-font="Gluten 800"');
		expect(layout.svg).not.toContain('src.b-3.label');
	});

	it('generates a source-preferred glyph from reference text when the source glyph is absent', function() {
		const map = semanticMap();
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'season-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					suits: {
						season: {
							suitId: 'season',
							parts: {
								glyph: {
									outputPresent: true,
									source: 'source-preferred',
									contentKind: 'glyph',
									role: 'season-character',
								},
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/season-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'season-1',
				family: 'season',
				optionalParts: {
					glyph: optionalPart('glyph', {
						sourceState: 'source-absent',
						contentKind: 'glyph',
						role: 'season-character',
					}),
				},
			}),
			semanticMapPath: 'semantic-map/season-1.json',
			semanticMap: map,
		});

		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('season-1', []),
			alignmentMap: alignmentMap([]),
			semanticMap: map,
			referenceStructure: referenceStructure('season-1', {
				glyph: {
					partId: 'glyph',
					role: 'season-character',
					targetBounds: box(70, 8, 86, 36),
					text: '春',
				},
			}),
		});

		expect(artifact.steps.addOptional.parts.glyph.renderKind).toBe('generated');
		expect(layout.step.parts.glyph.renderKind).toBe('generated');
		expect(layout.svg).toContain('data-generated-text="春"');
	});

	it('marks enabled optional parts unresolved when no source or generated decision exists', function() {
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'b-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/b-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'b-1',
				family: 'bamboo',
				optionalParts: {
					label: optionalPart('label', { sourceState: 'needs-review' }),
				},
			}),
			semanticMapPath: 'semantic-map/b-1.json',
			semanticMap: semanticMap(),
		});

		expect(artifact.status).toBe('needs-review');
		expect(artifact.steps.addOptional.parts.label.outputPresent).toBe(true);
		expect(artifact.steps.addOptional.parts.label.renderKind).toBe('unresolved');
		expect(artifact.diagnostics).toEqual([jasmine.objectContaining({
			code: 'unresolved-optional-render-part',
			partId: 'label',
		})]);
	});

	it('renders addOptional step SVG with source geometry and generated decision markers', function() {
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/flower-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-1',
				family: 'flower',
				optionalParts: {
					label: optionalPart('label', { sourceState: 'candidate-found' }),
					glyph: optionalPart('glyph', { contentKind: 'glyph', role: 'flower-character', sourceState: 'generated' }),
				},
			}),
			semanticMapPath: 'semantic-map/flower-1.json',
			semanticMap: semanticMap({
				assignments: [
					assignment('label', { sourceComponentIds: ['src.flower-1.0001'] }),
				],
				bindings: {
					'src.flower-1.0001': {
						partId: 'label',
						strength: 'strong',
					},
				},
			}),
			normalizedComponentsPath: 'normalized-components/flower-1.json',
			addOptionalSvgPath: 'final-rendering-svgs/add-optional/flower-1.svg',
		});

		const svg = buildAddOptionalSvg({
			artifact,
			normalizedComponents: normalizedArtifact('flower-1', [
				normalizedComponent('src.flower-1.0001', 'M0 0L10 0L10 10Z', { fill: '#bf3718' }),
			]),
		});

		expect(artifact.steps.addOptional.svg).toBe('final-rendering-svgs/add-optional/flower-1.svg');
		expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140">');
		expect(svg).toContain('data-render-part-id="label"');
		expect(svg).toContain('data-render-kind="source"');
		expect(svg).toContain('d="M0 0L10 0L10 10Z"');
		expect(svg).toContain('data-render-part-id="glyph" data-render-kind="generated"');
	});

	it('lays out accepted source assignments with alignment transforms', function() {
		const dotAssignment = assignment('dot.1', {
			assignmentId: 'assign.d-8.dot.1',
			contentKind: 'artwork',
			role: 'dot',
			sourceComponentIds: ['src.d-8.0019'],
			alignmentCandidateId: 'align.d-8.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'd-8',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/d-8.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'd-8',
				family: 'dot',
				value: 8,
				optionalParts: {
					label: optionalPart('label', { sourceState: 'source-absent' }),
				},
			}),
			semanticMapPath: 'semantic-map/d-8.json',
			semanticMap: semanticMap({
				faceKey: 'd-8',
				assignments: [
					dotAssignment,
					assignment('label', {
						assignmentId: 'assign.d-8.label',
						assignmentType: 'generated',
						sourceComponentIds: [],
					}),
				],
				parts: {
					label: {
						state: 'generated',
					},
				},
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/d-8.svg',
		});

		const result = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('d-8', [
				normalizedComponent('src.d-8.0019', 'M0 0L10 0L10 10Z', {
					fill: '#2a3b92',
					transform: {
						a: 1,
						b: 0,
						c: 0,
						d: 1,
						e: 5,
						f: 7,
					},
				}),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.d-8.01.0001', {
					matrix: [0.5, 0, 0, 0.5, 20, 30],
				}),
			]),
			semanticMap: semanticMap({
				assignments: [dotAssignment],
			}),
			referenceStructure: referenceStructure('d-8', {
				label: {
					targetBounds: {
						left: 6,
						top: 8,
						width: 12,
						height: 20,
					},
				},
			}),
		});

		expect(result.step.status).toBe('ready');
		expect(result.step.viewBox).toBe('0 0 94 136');
		expect(result.step.parts['dot.1']).toEqual(jasmine.objectContaining({
			status: 'ready',
			renderKind: 'source',
			alignmentCandidateId: 'align.d-8.01.0001',
		}));
		expect(result.svg).toContain('viewBox="0 0 94 136"');
		expect(result.svg).toContain('data-render-part-id="dot.1"');
		expect(result.svg).toContain('transform="matrix(0.5 0 0 0.5 22.5 33.5)"');
		expect(result.svg).toContain('data-render-part-id="label"');
		expect(result.svg).toContain('data-generated-text="8"');
		const labelTransform = result.svg.match(/data-render-part-id="label"[^>]+transform="matrix\(([^ ]+) 0 0 ([^ ]+) /);
		expect(labelTransform).not.toBeNull();
		expect(Number(labelTransform[1])).not.toBe(Number(labelTransform[2]));
	});

	it('bakes related negative-space components into laid-out source paths', function() {
		const dotAssignment = assignment('dot.1', {
			assignmentId: 'assign.d-8.dot.1',
			contentKind: 'artwork',
			role: 'dot',
			sourceComponentIds: ['src.d-8.0019'],
			alignmentCandidateId: 'align.d-8.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'd-8',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/d-8.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'd-8',
				family: 'dot',
				value: 8,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/d-8.json',
			semanticMap: semanticMap({
				assignments: [dotAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/d-8.svg',
		});

		const result = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('d-8', [
				normalizedComponent('src.d-8.0019', 'M0,0 H20 V20 H0 Z', {
					fill: '#2a3b92',
					bounds: box(0, 0, 20, 20),
					center: { x: 10, y: 10 },
					area: 400,
				}),
				normalizedComponent('src.d-8.cutout', 'M5,5 H15 V15 H5 Z', {
					fill: '#ffffff',
					bounds: box(5, 5, 15, 15),
					center: { x: 10, y: 10 },
					area: 100,
					negativeSpaceCandidate: true,
				}),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.d-8.01.0001', {
					matrix: [1, 0, 0, 1, 10, 0],
				}),
			]),
			semanticMap: semanticMap({
				assignments: [dotAssignment],
			}),
			referenceStructure: referenceStructure('d-8', {}),
		});

		expect(result.step.status).toBe('ready');
		expect(result.svg).toContain('data-negative-space="paper-subtract"');
		expect(result.svg).toContain('data-knockout-count="1"');
		expect(result.svg).not.toContain('data-component-id="src.d-8.cutout"');
		expect(result.svg).toContain('M10,0');
		expect(result.svg).toContain('M15,15');
	});

	it('uses per-component alignment candidates for grouped source assignments', function() {
		const glyphAssignment = assignment('glyph', {
			assignmentId: 'assign.c-3.glyph',
			contentKind: 'glyph',
			role: 'character-number-glyph',
			sourceComponentIds: ['src.c-3.upper', 'src.c-3.lower'],
			alignmentIds: ['align.c-3.02.0001', 'align.c-3.02.0002'],
			alignmentCandidateId: 'align.c-3.02.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'c-3',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/c-3.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'c-3',
				family: 'character',
				value: 3,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/c-3.json',
			semanticMap: semanticMap({
				faceKey: 'c-3',
				assignments: [glyphAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/c-3.svg',
		});

		const result = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('c-3', [
				normalizedComponent('src.c-3.upper', 'M0 0L10 0L10 10Z', { fill: '#2a3b92' }),
				normalizedComponent('src.c-3.lower', 'M0 20L10 20L10 30Z', { fill: '#2a3b92' }),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.c-3.02.0001', {
					matrix: [1, 0, 0, 1, 10, 0],
					sourceComponentIds: ['src.c-3.upper'],
				}),
				alignmentCandidate('align.c-3.02.0002', {
					matrix: [1, 0, 0, 1, 40, 0],
					sourceComponentIds: ['src.c-3.lower'],
				}),
			]),
			semanticMap: semanticMap({
				assignments: [glyphAssignment],
			}),
			referenceStructure: referenceStructure('c-3', {}),
		});

		expect(result.step.status).toBe('ready');
		expect(result.svg).toContain('data-component-id="src.c-3.upper"');
		expect(result.svg).toContain('data-component-id="src.c-3.lower"');
		expect(result.svg).toContain('transform="matrix(1 0 0 1 10 0)"');
		expect(result.svg).toContain('transform="matrix(1 0 0 1 40 0)"');
	});

	it('lays out accepted freeform artwork assignments with alignment transforms', function() {
		const artworkAssignment = assignment('mainArtwork', {
			assignmentId: 'assign.b-1.mainArtwork',
			contentKind: 'artwork',
			role: 'main-artwork',
			strategy: 'freeform-artwork',
			colorStrategy: 'freeform-palette',
			sourceComponentIds: ['src.b-1.0009', 'src.b-1.0010'],
			alignmentCandidateId: 'align.b-1.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'b-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/b-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'b-1',
				family: 'bamboo',
				value: 1,
				optionalParts: {
					label: optionalPart('label', { sourceState: 'source-absent' }),
				},
			}),
			semanticMapPath: 'semantic-map/b-1.json',
			semanticMap: semanticMap({
				faceKey: 'b-1',
				assignments: [
					artworkAssignment,
					assignment('label', {
						assignmentId: 'assign.b-1.label',
						assignmentType: 'generated',
						sourceComponentIds: [],
					}),
				],
				parts: {
					label: {
						state: 'generated',
					},
				},
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/b-1.svg',
		});

		const result = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('b-1', [
				normalizedComponent('src.b-1.0009', 'M0 0L10 0L10 10Z', { fill: '#2fc906' }),
				normalizedComponent('src.b-1.0010', 'M12 0L20 0L20 10Z', { fill: '#0505d1' }),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.b-1.01.0001', {
					matrix: [0.6, 0, 0, 0.6, 5, 8],
				}),
			]),
			semanticMap: semanticMap({
				assignments: [artworkAssignment],
			}),
			referenceStructure: referenceStructure('b-1', {
				label: {
					targetBounds: {
						left: 6,
						top: 8,
						width: 12,
						height: 20,
					},
				},
			}),
		});

		expect(result.step.status).toBe('ready');
		expect(result.step.parts.mainArtwork).toEqual(jasmine.objectContaining({
			status: 'ready',
			renderKind: 'source',
			sourceComponentIds: ['src.b-1.0009', 'src.b-1.0010'],
			alignmentCandidateId: 'align.b-1.01.0001',
		}));
		expect(result.svg).toContain('data-render-part-id="mainArtwork"');
		expect(result.svg).toContain('data-component-id="src.b-1.0009"');
		expect(result.svg).toContain('data-component-id="src.b-1.0010"');
	});

	it('mirrors only freeform artwork when the face render option is enabled', function() {
		const artworkAssignment = assignment('mainArtwork', {
			assignmentId: 'assign.b-1.mainArtwork',
			contentKind: 'artwork',
			role: 'main-artwork',
			strategy: 'freeform-artwork',
			colorStrategy: 'freeform-palette',
			sourceComponentIds: ['src.b-1.0009'],
			alignmentCandidateId: 'align.b-1.01.0001',
		});
		const labelAssignment = assignment('label', {
			assignmentId: 'assign.b-1.label',
			contentKind: 'label',
			role: 'suit-label',
			sourceComponentIds: ['src.b-1.label'],
			alignmentCandidateId: 'align.b-1.label',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'b-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					faces: {
						'b-1': {
							faceKey: 'b-1',
							suitId: 'bamboo',
							transform: {
								reflectX: true,
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/b-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'b-1',
				family: 'bamboo',
				value: 1,
				optionalParts: {
					label: optionalPart('label', { sourceState: 'candidate-found' }),
				},
			}),
			semanticMapPath: 'semantic-map/b-1.json',
			semanticMap: semanticMap({
				faceKey: 'b-1',
				assignments: [artworkAssignment, labelAssignment],
				bindings: {
					'src.b-1.label': {
						partId: 'label',
						strength: 'accepted',
					},
				},
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/b-1.svg',
		});

		const result = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('b-1', [
				normalizedComponent('src.b-1.0009', 'M0 0L20 0L20 10Z', { fill: '#2fc906', bounds: box(0, 0, 20, 10) }),
				normalizedComponent('src.b-1.label', 'M0 0L5 0L5 8Z', { fill: '#111111', bounds: box(0, 0, 5, 8) }),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.b-1.01.0001', {
					matrix: [0.6, 0, 0, 0.6, 5, 8],
				}),
				alignmentCandidate('align.b-1.label', {
					matrix: [1, 0, 0, 1, 4, 6],
				}),
			]),
			semanticMap: semanticMap({
				assignments: [artworkAssignment, labelAssignment],
			}),
			referenceStructure: referenceStructure('b-1', {}),
		});

		expect(result.step.parts.mainArtwork.transform).toEqual(jasmine.objectContaining({
			matrix: [-0.6, 0, 0, 0.6, 45, 8],
			reflectX: true,
		}));
		expect(result.step.parts.label.transform.matrix).toEqual([1, 0, 0, 1, 4, 6]);
		expect(result.svg).toContain('data-component-id="src.b-1.0009"');
		expect(result.svg).toContain('data-artwork-mirror="x"');
		expect(result.svg).toContain('transform="matrix(-0.6 0 0 0.6 45 8)"');
		expect(result.svg).toContain('transform="matrix(1 0 0 1 4 6)"');
	});

	it('applies largest-containing-box layout from suit scaleMode without a family-specific branch', function() {
		const artworkAssignment = assignment('mainArtwork', {
			assignmentId: 'assign.flower-1.mainArtwork',
			contentKind: 'artwork',
			role: 'main-artwork',
			sourceComponentIds: ['src.flower-1.0009'],
			alignmentCandidateId: 'align.flower-1.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					suits: {
						flower: {
							suitId: 'flower',
							layout: {
								scaleMode: 'largest-containing-box',
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/flower-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'flower-1',
				family: 'flower',
				value: 1,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/flower-1.json',
			semanticMap: semanticMap({
				faceKey: 'flower-1',
				assignments: [artworkAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/flower-1.svg',
		});

		const result = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('flower-1', [
				normalizedComponent('src.flower-1.0009', 'M10 20L30 20L30 60L10 60Z', {
					fill: '#038249',
					bounds: box(10, 20, 30, 60),
				}),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.flower-1.01.0001', {
					matrix: [0.25, 0, 0, 0.25, 3, 4],
				}),
			]),
			semanticMap: semanticMap({
				assignments: [artworkAssignment],
			}),
			referenceStructure: referenceStructure('flower-1', {
				mainArtwork: {
					role: 'main-artwork',
					targetBounds: box(20, 30, 70, 110),
				},
			}),
		});

		expect(result.step.status).toBe('ready');
		expect(result.step.parts.mainArtwork.source).toBe('largest-containing-box');
		expect(result.step.parts.mainArtwork.transform.scaleMode).toBe('largest-containing-box');
		expect(result.svg).toContain('data-layout-source="largest-containing-box"');
		expect(result.svg).not.toContain('transform="matrix(0.25 0 0 0.25 5.5 9)"');
	});

	it('applies rendering defaults before mutable output option overrides', function() {
		const artworkAssignment = assignment('mainArtwork', {
			assignmentId: 'assign.dragon-r.mainArtwork',
			contentKind: 'artwork',
			role: 'dragon-artwork',
			sourceComponentIds: ['src.dragon-r.0001'],
			alignmentCandidateId: 'align.dragon-r.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'default',
			faceKey: 'dragon-r',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				defaults: {
					suits: {
						dragons: {
							layout: {
								scaleMode: 'largest-containing-box',
							},
							parts: {
								label: {
									partId: 'label',
									contentKind: 'label',
									outputPresent: true,
									renderMode: 'generated',
								},
							},
						},
					},
				},
				overrides: {
					suits: {
						dragon: {
							suitId: 'dragon',
							parts: {
								label: {
									partId: 'label',
									contentKind: 'label',
									outputPresent: false,
									renderMode: 'omit',
								},
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/dragon-r.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'dragon-r',
				family: 'dragon',
				value: 'r',
				optionalParts: {
					label: {
						partId: 'label',
						contentKind: 'label',
						sourceState: 'absent',
						text: 'R',
					},
				},
			}),
			semanticMapPath: 'semantic-map/dragon-r.json',
			semanticMap: semanticMap({
				faceKey: 'dragon-r',
				assignments: [artworkAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/dragon-r.svg',
		});

		const result = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('dragon-r', [
				normalizedComponent('src.dragon-r.0001', 'M10 20L30 20L30 60L10 60Z', {
					fill: '#c20000',
					bounds: box(10, 20, 30, 60),
				}),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.dragon-r.01.0001', {
					matrix: [0.25, 0, 0, 0.25, 3, 4],
				}),
			]),
			semanticMap: semanticMap({
				assignments: [artworkAssignment],
			}),
			referenceStructure: referenceStructure('dragon-r', {
				mainArtwork: {
					role: 'dragon-artwork',
					targetBounds: box(20, 30, 70, 110),
				},
			}),
		});

		expect(artifact.inputs.outputOptions.layout.scaleMode).toBe('largest-containing-box');
		expect(artifact.steps.addOptional.parts.label.renderKind).toBe('omit');
		expect(result.step.parts.mainArtwork.source).toBe('largest-containing-box');
	});

	it('colors laid-out source assignments with reference palette decisions', function() {
		const dotAssignment = assignment('dot.1', {
			assignmentId: 'assign.d-8.dot.1',
			contentKind: 'artwork',
			role: 'dot',
			sourceComponentIds: ['src.d-8.0019'],
			referenceComponentIds: ['ref.d-8.0001'],
			alignmentCandidateId: 'align.d-8.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'd-8',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/d-8.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'd-8',
				family: 'dot',
				value: 8,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/d-8.json',
			semanticMap: semanticMap({
				faceKey: 'd-8',
				assignments: [dotAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/d-8.svg',
			colorSvgPath: 'final-rendering-svgs/color/d-8.svg',
		});
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('d-8', [
				normalizedComponent('src.d-8.0019', 'M0 0L10 0L10 10Z', { fill: '#2a3b92' }),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.d-8.01.0001', {
					matrix: [0.5, 0, 0, 0.5, 20, 30],
					sourceComponentIds: ['src.d-8.0019'],
					referenceComponentIds: ['ref.d-8.0001'],
				}),
			]),
			semanticMap: semanticMap({
				assignments: [dotAssignment],
			}),
			referenceStructure: referenceStructure('d-8', {
				'dot.1': {
					role: 'dot',
					dominantColor: '#0505D1',
					componentIds: ['ref.d-8.0001'],
				},
			}, [
				referenceComponent('ref.d-8.0001', box(20, 30, 30, 40), { dominantColor: '#0505D1' }),
			]),
		});
		artifact.steps.layout = layout.step;

		const result = buildColorStep({
			artifact,
			normalizedComponents: normalizedArtifact('d-8', [
				normalizedComponent('src.d-8.0019', 'M0 0L10 0L10 10Z', { fill: '#2a3b92' }),
			]),
			alignmentMap: alignmentMap([
				alignmentCandidate('align.d-8.01.0001', {
					matrix: [0.5, 0, 0, 0.5, 20, 30],
					sourceComponentIds: ['src.d-8.0019'],
					referenceComponentIds: ['ref.d-8.0001'],
				}),
			]),
			semanticMap: semanticMap({
				assignments: [dotAssignment],
			}),
			referenceStructure: referenceStructure('d-8', {
				'dot.1': {
					role: 'dot',
					dominantColor: '#0505D1',
					componentIds: ['ref.d-8.0001'],
				},
			}, [
				referenceComponent('ref.d-8.0001', box(20, 30, 30, 40), { dominantColor: '#0505D1' }),
			]),
		});

		expect(result.step.status).toBe('ready');
		expect(result.step.policy).toBe('reference-color');
		expect(result.step.parts['dot.1'].components['src.d-8.0019']).toEqual(jasmine.objectContaining({
			sourcePaint: '#2a3b92',
			targetPaint: '#0505D1',
			outputPaint: '#0505D1',
		}));
		expect(result.svg).toContain('id="color-source-parts"');
		expect(result.svg).toContain('fill="#0505D1"');
		expect(result.svg).toContain('data-color-policy="reference-color"');
		expect(result.svg).toContain('data-source-paint="#2a3b92"');
		expect(result.svg).toContain('data-target-paint="#0505D1"');
	});

	it('keeps separate one-color target parts from creating extra shades', function() {
		const bambooAssignments = [
			assignment('bamboo.1', {
				assignmentId: 'assign.b-5.bamboo.1',
				contentKind: 'artwork',
				role: 'bamboo-stick',
				sourceComponentIds: ['src.b-5.0010'],
				referenceComponentIds: ['ref.b-5.0001'],
				alignmentCandidateId: 'align.b-5.01.0001',
			}),
			assignment('bamboo.2', {
				assignmentId: 'assign.b-5.bamboo.2',
				contentKind: 'artwork',
				role: 'bamboo-stick',
				sourceComponentIds: ['src.b-5.0011'],
				referenceComponentIds: ['ref.b-5.0002'],
				alignmentCandidateId: 'align.b-5.01.0002',
			}),
		];
		const sourceComponents = [
			normalizedComponent('src.b-5.0010', 'M0 0L10 0L10 10Z', { fill: '#038249', sourceIndex: 10 }),
			normalizedComponent('src.b-5.0011', 'M20 0L30 0L30 10Z', { fill: '#bf3718', sourceIndex: 11 }),
		];
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'b-5',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/b-5.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'b-5',
				family: 'bamboo',
				value: 5,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/b-5.json',
			semanticMap: semanticMap({
				faceKey: 'b-5',
				assignments: bambooAssignments,
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/b-5.svg',
			colorSvgPath: 'final-rendering-svgs/color/b-5.svg',
		});
		const candidates = alignmentMap([
			alignmentCandidate('align.b-5.01.0001', {
				matrix: [0.5, 0, 0, 0.5, 20, 30],
				sourceComponentIds: ['src.b-5.0010'],
				referenceComponentIds: ['ref.b-5.0001'],
			}),
			alignmentCandidate('align.b-5.01.0002', {
				matrix: [0.5, 0, 0, 0.5, 40, 30],
				sourceComponentIds: ['src.b-5.0011'],
				referenceComponentIds: ['ref.b-5.0002'],
			}),
		]);
		const references = referenceStructure('b-5', {
			'bamboo.1': {
				role: 'bamboo-stick',
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906'],
				componentIds: ['ref.b-5.0001'],
			},
			'bamboo.2': {
				role: 'bamboo-stick',
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906'],
				componentIds: ['ref.b-5.0002'],
			},
		}, [
			referenceComponent('ref.b-5.0001', box(20, 30, 30, 40), { dominantColor: '#2FC906', paletteColors: ['#2FC906'] }),
			referenceComponent('ref.b-5.0002', box(40, 30, 50, 40), { dominantColor: '#2FC906', paletteColors: ['#2FC906'] }),
		]);
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('b-5', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: bambooAssignments,
			}),
			referenceStructure: references,
		});
		artifact.steps.layout = layout.step;

		const result = buildColorStep({
			artifact,
			normalizedComponents: normalizedArtifact('b-5', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: bambooAssignments,
			}),
			referenceStructure: references,
		});

		expect(result.step.parts['bamboo.1'].components['src.b-5.0010'].outputPaint).toBe('#2FC906');
		expect(result.step.parts['bamboo.2'].components['src.b-5.0011'].outputPaint).toBe('#2FC906');
		expect(result.step.parts['bamboo.2'].components['src.b-5.0011'].colorMode).toBe('reference-shaded');
		expect(result.svg.match(/fill="#2FC906"/g).length).toBe(2);
		expect(result.svg).not.toContain('#64F44E');
	});

	it('uses representative gradient colors as palette evidence for source URL paints', function() {
		const bambooAssignment = assignment('bamboo.1', {
			assignmentId: 'assign.b-3.bamboo.1',
			contentKind: 'artwork',
			role: 'bamboo-stick',
			sourceComponentIds: [
				'src.b-3.body',
				'src.b-3.cap',
				'src.b-3.band',
				'src.b-3.outline',
			],
			referenceComponentIds: ['ref.b-3.0001'],
			alignmentCandidateId: 'align.b-3.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'classic',
			faceKey: 'b-3',
			generatedOn: '2026-05-08T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/b-3.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'b-3',
				family: 'bamboo',
				value: 3,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/b-3.json',
			semanticMap: semanticMap({
				faceKey: 'b-3',
				assignments: [bambooAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/b-3.svg',
			colorSvgPath: 'final-rendering-svgs/color/b-3.svg',
		});
		const sourceComponents = [
			normalizedComponent('src.b-3.body', 'M0 0L10 0L10 30Z', {
				fill: 'url(#linearGradient8797)',
				area: 300,
				sourceIndex: 1,
			}),
			normalizedComponent('src.b-3.cap', 'M0 0L10 0L10 4Z', {
				fill: '#108431',
				area: 50,
				sourceIndex: 2,
			}),
			normalizedComponent('src.b-3.band', 'M0 10L10 10L10 12Z', {
				fill: '#5c003f',
				area: 40,
				sourceIndex: 3,
			}),
			normalizedComponent('src.b-3.outline', 'M0 0L10 0L10 30Z', {
				fill: 'none',
				stroke: 'black',
				strokeWidth: '1',
				area: 80,
				sourceIndex: 4,
			}),
		];
		const normalizedComponents = {
			...normalizedArtifact('b-3', sourceComponents),
			sourceDefs: `
				<defs>
					<linearGradient id="linearGradient8797">
						<stop offset="0" stop-color="#f7f7f7"/>
						<stop offset="1" style="stop-color:#b8b8b8"/>
					</linearGradient>
				</defs>
			`,
		};
		const candidates = alignmentMap([
			alignmentCandidate('align.b-3.01.0001', {
				matrix: [1, 0, 0, 1, 0, 0],
				sourceComponentIds: bambooAssignment.sourceComponentIds,
				referencePartIds: ['bamboo.1'],
				referenceComponentIds: ['ref.b-3.0001'],
			}),
		]);
		const references = referenceStructure('b-3', {
			'bamboo.1': {
				role: 'bamboo-stick',
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906'],
				componentIds: ['ref.b-3.0001'],
			},
		}, [
			referenceComponent('ref.b-3.0001', box(20, 30, 30, 60), { dominantColor: '#2FC906', paletteColors: ['#2FC906'] }),
		]);
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents,
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [bambooAssignment],
			}),
			referenceStructure: references,
		});
		artifact.steps.layout = layout.step;

		const result = buildColorStep({
			artifact,
			normalizedComponents,
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [bambooAssignment],
			}),
			referenceStructure: references,
		});
		const components = result.step.parts['bamboo.1'].components;

		expect(components['src.b-3.body'].paletteSourcePaint).toBe('#D8D8D8');
		expect(components['src.b-3.body'].outputPaint).not.toBe('#2FC906');
		expect(components['src.b-3.cap'].outputPaint).toBe('#2FC906');
		expect(components['src.b-3.outline'].outputPaint).not.toBe('#2FC906');
		expect(result.svg).toContain('data-source-paint="url(#linearGradient8797)"');
		expect(result.svg).toContain('data-palette-source-paint="#D8D8D8"');
	});

	it('renders layered source components in original source order for grouped artwork', function() {
		const bambooAssignment = assignment('bambooGroup.1', {
			assignmentId: 'assign.b-8.bambooGroup.1',
			contentKind: 'artwork',
			role: 'bamboo-group',
			sourceComponentIds: [
				'src.b-8.dark-right-slanted',
				'src.b-8.light-left',
				'src.b-8.dark-left',
				'src.b-8.light-right-slanted',
			],
			referenceComponentIds: ['ref.b-8.0001'],
			alignmentCandidateId: 'align.b-8.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'traditional',
			faceKey: 'b-8',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/b-8.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'b-8',
				family: 'bamboo',
				value: 8,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/b-8.json',
			semanticMap: semanticMap({
				faceKey: 'b-8',
				assignments: [bambooAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/b-8.svg',
			colorSvgPath: 'final-rendering-svgs/color/b-8.svg',
		});
		const sourceComponents = [
			normalizedComponent('src.b-8.light-left', 'M0 0L10 0L10 10Z', {
				fill: '#5be335',
				sourceIndex: 14,
			}),
			normalizedComponent('src.b-8.dark-left', 'M0 0L12 0L12 12Z', {
				fill: '#069200',
				sourceIndex: 15,
			}),
			normalizedComponent('src.b-8.light-right-slanted', 'M20 0L30 0L30 10Z', {
				fill: '#5be335',
				sourceIndex: 16,
			}),
			normalizedComponent('src.b-8.dark-right-slanted', 'M20 0L32 0L32 12Z', {
				fill: '#069200',
				sourceIndex: 17,
			}),
		];
		const candidates = alignmentMap([
			alignmentCandidate('align.b-8.01.0001', {
				matrix: [1, 0, 0, 1, 0, 0],
				sourceComponentIds: [
					'src.b-8.dark-right-slanted',
					'src.b-8.light-left',
					'src.b-8.dark-left',
					'src.b-8.light-right-slanted',
				],
				referenceComponentIds: ['ref.b-8.0001'],
			}),
		]);
		const references = referenceStructure('b-8', {
			'bambooGroup.1': {
				role: 'bamboo-group',
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906'],
				componentIds: ['ref.b-8.0001'],
			},
		}, [
			referenceComponent('ref.b-8.0001', box(10, 20, 80, 60), {
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906'],
			}),
		]);
		const normalizedComponents = normalizedArtifact('b-8', sourceComponents);
		const semantic = semanticMap({
			faceKey: 'b-8',
			assignments: [bambooAssignment],
		});
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents,
			alignmentMap: candidates,
			semanticMap: semantic,
			referenceStructure: references,
		});
		artifact.steps.layout = layout.step;
		const color = buildColorStep({
			artifact,
			normalizedComponents,
			alignmentMap: candidates,
			semanticMap: semantic,
			referenceStructure: references,
		});

		expect(layout.step.parts['bambooGroup.1'].sourceComponentIds).toEqual([
			'src.b-8.light-left',
			'src.b-8.dark-left',
			'src.b-8.light-right-slanted',
			'src.b-8.dark-right-slanted',
		]);
		expect(color.step.parts['bambooGroup.1'].sourceComponentIds).toEqual([
			'src.b-8.light-left',
			'src.b-8.dark-left',
			'src.b-8.light-right-slanted',
			'src.b-8.dark-right-slanted',
		]);
		expect(color.svg.indexOf('data-component-id="src.b-8.light-right-slanted"'))
			.toBeLessThan(color.svg.indexOf('data-component-id="src.b-8.dark-right-slanted"'));
	});

	it('lays out multi-component glyph assignments as one whole part transform', function() {
		const glyphAssignment = assignment('glyph', {
			assignmentId: 'assign.c-2.glyph',
			contentKind: 'glyph',
			role: 'character-number-glyph',
			sourceComponentIds: ['src.c-2.top-stroke', 'src.c-2.bottom-stroke'],
			referenceComponentIds: ['ref.c-2.top-stroke', 'ref.c-2.bottom-stroke'],
			alignmentCandidateId: 'align.c-2.glyph.1',
			alignmentIds: ['align.c-2.glyph.1', 'align.c-2.glyph.2'],
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'traditional',
			faceKey: 'c-2',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/c-2.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'c-2',
				family: 'character',
				value: 2,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/c-2.json',
			semanticMap: semanticMap({
				faceKey: 'c-2',
				assignments: [glyphAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/c-2.svg',
			colorSvgPath: 'final-rendering-svgs/color/c-2.svg',
		});
		const sourceComponents = [
			normalizedComponent('src.c-2.top-stroke', 'M0 0L20 0L20 4Z', {
				bounds: box(0, 0, 20, 4),
				sourceIndex: 1,
			}),
			normalizedComponent('src.c-2.bottom-stroke', 'M0 20L40 20L40 24Z', {
				bounds: box(0, 20, 40, 24),
				sourceIndex: 2,
			}),
		];
		const candidates = alignmentMap([
			alignmentCandidate('align.c-2.glyph.1', {
				matrix: [2, 0, 0, 2, 0, 0],
				sourceComponentIds: ['src.c-2.top-stroke'],
				referenceComponentIds: ['ref.c-2.top-stroke'],
				targetBounds: box(30, 10, 50, 18),
			}),
			alignmentCandidate('align.c-2.glyph.2', {
				matrix: [1, 0, 0, 1, 30, 20],
				sourceComponentIds: ['src.c-2.bottom-stroke'],
				referenceComponentIds: ['ref.c-2.bottom-stroke'],
				targetBounds: box(20, 32, 70, 44),
			}),
		]);
		const references = referenceStructure('c-2', {
			glyph: {
				role: 'character-number-glyph',
				componentIds: ['ref.c-2.top-stroke', 'ref.c-2.bottom-stroke'],
			},
		}, [
			referenceComponent('ref.c-2.top-stroke', box(30, 10, 50, 18)),
			referenceComponent('ref.c-2.bottom-stroke', box(20, 32, 70, 44)),
		]);
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('c-2', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				faceKey: 'c-2',
				assignments: [glyphAssignment],
			}),
			referenceStructure: references,
		});

		expect(layout.step.parts.glyph.transform.source).toBe('whole-part-alignment');
		expect(layout.step.parts.glyph.transform.matrix).not.toEqual([2, 0, 0, 2, 0, 0]);
		expect(layout.step.parts.glyph.transform.matrix).not.toEqual([1, 0, 0, 1, 30, 20]);
		expect(layout.svg.match(/transform="matrix\(/g).length).toBe(2);
		expect(new Set(layout.svg.match(/transform="matrix\([^"]+\)"/g)).size).toBe(1);
	});

	it('shades the source-matched palette color for freeform artwork', function() {
		const artworkAssignment = assignment('mainArtwork', {
			assignmentId: 'assign.season-2.mainArtwork',
			contentKind: 'artwork',
			role: 'main-artwork',
			strategy: 'layered-overlap',
			colorStrategy: 'freeform-palette',
			sourceComponentIds: ['src.season-2.0011'],
			referenceComponentIds: ['ref.season-2.0003'],
			alignmentCandidateId: 'align.season-2.03.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'season-2',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/season-2.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'season-2',
				family: 'season',
				value: 2,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/season-2.json',
			semanticMap: semanticMap({
				faceKey: 'season-2',
				assignments: [artworkAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/season-2.svg',
			colorSvgPath: 'final-rendering-svgs/color/season-2.svg',
		});
		const sourceComponents = [
			normalizedComponent('src.season-2.0011', 'M0 0L10 0L10 10Z', { fill: '#ff4a2a', sourceIndex: 11 }),
			normalizedComponent('src.season-2.0012', 'M20 0L30 0L30 10Z', { fill: '#FC1D05', sourceIndex: 12 }),
		];
		const candidates = alignmentMap([
			alignmentCandidate('align.season-2.03.0001', {
				matrix: [0.5, 0, 0, 0.5, 20, 30],
				sourceComponentIds: ['src.season-2.0011'],
				referenceComponentIds: ['ref.season-2.0003'],
			}),
		]);
		const references = referenceStructure('season-2', {
			mainArtwork: {
				role: 'main-artwork',
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906', '#0505D1', '#FC1D05', '#FF9900'],
				componentIds: ['ref.season-2.0003'],
			},
		}, [
			referenceComponent('ref.season-2.0003', box(15, 48, 144, 221), {
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906', '#0505D1', '#FC1D05', '#FF9900'],
			}),
		]);
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('season-2', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [artworkAssignment],
			}),
			referenceStructure: references,
		});
		artifact.steps.layout = layout.step;

		const result = buildColorStep({
			artifact,
			normalizedComponents: normalizedArtifact('season-2', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [artworkAssignment],
			}),
			referenceStructure: references,
		});

		expect(result.step.parts.mainArtwork.components['src.season-2.0011']).toEqual(jasmine.objectContaining({
			colorMode: 'freeform-palette',
			sourcePaint: '#ff4a2a',
			targetPaint: '#FC1D05',
			outputPaint: '#FC1D05',
		}));
		expect(result.svg).toContain('fill="#FC1D05"');
		expect(result.svg).not.toContain('fill="#2FC906"');
	});

	it('preserves flattened source colors for freeform artwork when requested', function() {
		const artworkAssignment = assignment('mainArtwork', {
			assignmentId: 'assign.season-2.mainArtwork',
			contentKind: 'artwork',
			role: 'main-artwork',
			strategy: 'freeform-artwork',
			colorStrategy: 'freeform-palette',
			sourceComponentIds: ['src.season-2.trunk'],
			referenceComponentIds: ['ref.season-2.tree'],
			alignmentCandidateId: 'align.season-2.tree',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'season-2',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: renderingState({
				overrides: {
					faces: {
						'season-2': {
							faceKey: 'season-2',
							suitId: 'season',
							artwork: {
								preserveColors: true,
							},
						},
					},
				},
			}),
			optionalAssignmentPath: 'optional-parts/season-2.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'season-2',
				family: 'season',
				value: 2,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/season-2.json',
			semanticMap: semanticMap({
				faceKey: 'season-2',
				assignments: [artworkAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/season-2.svg',
			colorSvgPath: 'final-rendering-svgs/color/season-2.svg',
		});
		const sourceComponents = [
			normalizedComponent('src.season-2.trunk', 'M0 0L10 0L10 10Z', { fill: '#780027', sourceIndex: 11 }),
			normalizedComponent('src.season-2.unassigned', 'M20 0L30 0L30 10Z', { fill: '#2FC906', sourceIndex: 12 }),
		];
		const candidates = alignmentMap([
			alignmentCandidate('align.season-2.tree', {
				matrix: [0.5, 0, 0, 0.5, 20, 30],
				sourceComponentIds: ['src.season-2.trunk'],
				referenceComponentIds: ['ref.season-2.tree'],
			}),
		]);
		const references = referenceStructure('season-2', {
			mainArtwork: {
				role: 'main-artwork',
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906', '#FC1D05'],
				componentIds: ['ref.season-2.tree'],
			},
		}, [
			referenceComponent('ref.season-2.tree', box(15, 48, 144, 221), {
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906', '#FC1D05'],
			}),
		]);
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('season-2', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [artworkAssignment],
			}),
			referenceStructure: references,
		});
		artifact.steps.layout = layout.step;

		const result = buildColorStep({
			artifact,
			normalizedComponents: normalizedArtifact('season-2', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [artworkAssignment],
			}),
			referenceStructure: references,
		});

		expect(result.step.parts.mainArtwork.components['src.season-2.trunk']).toEqual(jasmine.objectContaining({
			colorMode: 'freeform-preserve',
			sourcePaint: '#780027',
			targetPaint: '#780027',
			outputPaint: '#780027',
		}));
		expect(result.svg).toContain('fill="#780027"');
		expect(result.svg).not.toContain('fill="#2FC906"');
	});

	it('uses freeform overlap evidence before interpolation for layered shades', function() {
		const artworkAssignment = assignment('mainArtwork', {
			assignmentId: 'assign.d-1.mainArtwork',
			contentKind: 'artwork',
			role: 'main-artwork',
			strategy: 'layered-overlap',
			colorStrategy: 'freeform-palette',
			sourceComponentIds: [
				'src.d-1.pink',
				'src.d-1.pink-detail',
				'src.d-1.bright-green',
				'src.d-1.dark-green',
			],
			referenceComponentIds: ['ref.d-1.0001'],
			alignmentCandidateId: 'align.d-1.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'traditional',
			faceKey: 'd-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/d-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'd-1',
				family: 'dot',
				value: 1,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/d-1.json',
			semanticMap: semanticMap({
				faceKey: 'd-1',
				assignments: [artworkAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/d-1.svg',
			colorSvgPath: 'final-rendering-svgs/color/d-1.svg',
		});
		const sourceComponents = [
			normalizedComponent('src.d-1.unrendered-pink-cruft', 'M-100 0L-90 0L-90 10Z', {
				fill: '#d46584',
				sourceIndex: 0,
				area: 100,
			}),
			normalizedComponent('src.d-1.pink', 'M0 0L10 0L10 10Z', {
				fill: '#f5b1b1',
				sourceIndex: 1,
				area: 100,
			}),
			normalizedComponent('src.d-1.pink-detail', 'M20 0L30 0L30 10Z', {
				fill: '#f5b1b1',
				sourceIndex: 2,
				area: 50,
			}),
			normalizedComponent('src.d-1.bright-green', 'M40 0L50 0L50 10Z', {
				fill: '#37ff00',
				sourceIndex: 3,
				area: 100,
			}),
			normalizedComponent('src.d-1.dark-green', 'M60 0L70 0L70 10Z', {
				fill: '#069200',
				sourceIndex: 4,
				area: 100,
			}),
		];
		const candidates = alignmentMap([
			alignmentCandidate('align.d-1.01.0001', {
				matrix: [0.5, 0, 0, 0.5, 20, 30],
				sourceComponentIds: [
					'src.d-1.pink',
					'src.d-1.pink-detail',
					'src.d-1.bright-green',
					'src.d-1.dark-green',
				],
				referenceComponentIds: ['ref.d-1.0001'],
			}),
		]);
		const references = referenceStructure('d-1', {
			mainArtwork: {
				role: 'main-artwork',
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906'],
				componentIds: ['ref.d-1.0001'],
			},
		}, [
			referenceComponent('ref.d-1.0001', box(15, 48, 144, 221), {
				dominantColor: '#2FC906',
				paletteColors: ['#2FC906'],
			}),
		]);
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('d-1', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [artworkAssignment],
			}),
			referenceStructure: references,
		});
		artifact.steps.layout = layout.step;

		const result = buildColorStep({
			artifact,
			normalizedComponents: normalizedArtifact('d-1', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [artworkAssignment],
			}),
			referenceStructure: references,
		});

		expect(result.step.parts.mainArtwork.components['src.d-1.pink']).toEqual(jasmine.objectContaining({
			colorMode: 'freeform-palette',
			hueGrouping: 'source-hues',
			sourcePaint: '#f5b1b1',
			targetPaint: '#F5B1B1',
			outputPaint: '#F5B1B1',
		}));
		expect(result.step.parts.mainArtwork.components['src.d-1.pink-detail']).toEqual(jasmine.objectContaining({
			colorMode: 'freeform-palette',
			hueGrouping: 'source-hues',
			sourcePaint: '#f5b1b1',
			targetPaint: '#F5B1B1',
			outputPaint: '#F5B1B1',
		}));
		expect(result.step.parts.mainArtwork.components['src.d-1.bright-green']).toEqual(jasmine.objectContaining({
			colorMode: 'freeform-palette',
			hueGrouping: 'source-hues',
			sourcePaint: '#37ff00',
			targetPaint: '#2FC906',
			outputPaint: '#2FC906',
		}));
		expect(result.step.parts.mainArtwork.components['src.d-1.dark-green']).toEqual(jasmine.objectContaining({
			colorMode: 'freeform-palette',
			hueGrouping: 'source-hues',
			sourcePaint: '#069200',
			targetPaint: '#2FC906',
			outputPaint: '#004D00',
		}));
		expect(result.svg).toContain('fill="#F5B1B1"');
		expect(result.svg).toContain('fill="#2FC906"');
		expect(result.svg).toContain('fill="#004D00"');
		expect(result.svg).not.toContain('fill="#E58B9A"');
	});

	it('keeps character glyphs monochrome with the dominant reference paint', function() {
		const glyphAssignment = assignment('glyph', {
			assignmentId: 'assign.wind-s.glyph',
			contentKind: 'glyph',
			role: 'wind-character',
			sourceComponentIds: ['src.wind-s.0009'],
			referenceComponentIds: ['ref.wind-s.0002'],
			alignmentCandidateId: 'align.wind-s.01.0001',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'wind-s',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/wind-s.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'wind-s',
				family: 'wind',
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/wind-s.json',
			semanticMap: semanticMap({
				faceKey: 'wind-s',
				assignments: [glyphAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/wind-s.svg',
			colorSvgPath: 'final-rendering-svgs/color/wind-s.svg',
		});
		const sourceComponents = [
			normalizedComponent('src.wind-s.0009', 'M0 0L10 0L10 10Z', { fill: '#2a3b92', sourceIndex: 9 }),
		];
		const candidates = alignmentMap([
			alignmentCandidate('align.wind-s.01.0001', {
				matrix: [0.5, 0, 0, 0.5, 20, 30],
				sourceComponentIds: ['src.wind-s.0009'],
				referenceComponentIds: ['ref.wind-s.0002'],
			}),
		]);
		const references = referenceStructure('wind-s', {
			glyph: {
				role: 'wind-character',
				dominantColor: '#000000',
				paletteColors: ['#000000', '#FC1D05'],
				componentIds: ['ref.wind-s.0002'],
			},
		}, [
			referenceComponent('ref.wind-s.0002', box(47, 72, 119, 178), {
				dominantColor: '#000000',
				paletteColors: ['#000000', '#FC1D05'],
			}),
		]);
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('wind-s', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [glyphAssignment],
			}),
			referenceStructure: references,
		});
		artifact.steps.layout = layout.step;

		const result = buildColorStep({
			artifact,
			normalizedComponents: normalizedArtifact('wind-s', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				assignments: [glyphAssignment],
			}),
			referenceStructure: references,
		});

		expect(result.step.parts.glyph.components['src.wind-s.0009']).toEqual(jasmine.objectContaining({
			colorMode: 'monochrome-reference',
			sourcePaint: '#2a3b92',
			targetPaint: '#000000',
			outputPaint: '#000000',
		}));
		expect(result.svg).toContain('fill="#000000"');
		expect(result.svg).not.toContain('fill="#FC1D05"');
	});

	it('recombines same-source evenodd fragments before final SVG emission', function() {
		const bodyAssignment = assignment('body', {
			assignmentId: 'assign.c-9.body',
			contentKind: 'glyph',
			role: 'character-body',
			sourceComponentIds: ['src.c-9.body.top', 'src.c-9.body.main'],
			referenceComponentIds: ['ref.c-9.body'],
			alignmentCandidateId: 'align.c-9.body',
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'traditional',
			faceKey: 'c-9',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/c-9.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'c-9',
				family: 'character',
				value: 9,
				optionalParts: {},
			}),
			semanticMapPath: 'semantic-map/c-9.json',
			semanticMap: semanticMap({
				faceKey: 'c-9',
				assignments: [bodyAssignment],
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/c-9.svg',
			colorSvgPath: 'final-rendering-svgs/color/c-9.svg',
		});
		const sourceComponents = [
			normalizedComponent('src.c-9.body.top', 'M10 0h10v10h-10z', {
				fill: '#c20000',
				fillRule: 'evenodd',
				sourceIndex: 6,
				sourceElementId: 'path3478',
				sourceUseInstanceId: 'source-use.0002.path3478',
			}),
			normalizedComponent('src.c-9.body.main', 'M0 0h20v20h-20z M10 0h10v10h-10z', {
				fill: '#c20000',
				fillRule: 'evenodd',
				sourceIndex: 6,
				sourceElementId: 'path3478',
				sourceUseInstanceId: 'source-use.0002.path3478',
				transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 0 },
			}),
		];
		const candidates = alignmentMap([
			alignmentCandidate('align.c-9.body', {
				matrix: [1, 0, 0, 1, 0, 0],
				sourceComponentIds: ['src.c-9.body.top', 'src.c-9.body.main'],
				referenceComponentIds: ['ref.c-9.body'],
			}),
		]);
		const references = referenceStructure('c-9', {
			body: {
				role: 'character-body',
				dominantColor: '#FC1D05',
				componentIds: ['ref.c-9.body'],
			},
		}, [
			referenceComponent('ref.c-9.body', box(10, 50, 80, 120), {
				dominantColor: '#FC1D05',
			}),
		]);
		const layout = buildLayoutStep({
			artifact,
			normalizedComponents: normalizedArtifact('c-9', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				faceKey: 'c-9',
				assignments: [bodyAssignment],
			}),
			referenceStructure: references,
		});
		artifact.steps.layout = layout.step;

		const result = buildColorStep({
			artifact,
			normalizedComponents: normalizedArtifact('c-9', sourceComponents),
			alignmentMap: candidates,
			semanticMap: semanticMap({
				faceKey: 'c-9',
				assignments: [bodyAssignment],
			}),
			referenceStructure: references,
		});

		expect(result.svg.match(/<path fill="#FC1D05"/g).length).toBe(1);
		expect(result.svg).toContain('fill-rule="evenodd"');
		expect(result.svg).toContain('data-geometry-normalized="source-element-recombined"');
		expect(result.svg).toContain('data-component-id="src.c-9.body.top src.c-9.body.main"');
	});

	it('colors generated layout parts through the color step', function() {
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId: 'wiki',
			faceKey: 'b-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			tilesetState: {},
			optionalAssignmentPath: 'optional-parts/b-1.json',
			optionalAssignment: optionalAssignment({
				faceKey: 'b-1',
				family: 'bamboo',
				value: 1,
				optionalParts: {
					label: optionalPart('label', { sourceState: 'source-absent' }),
				},
			}),
			semanticMapPath: 'semantic-map/b-1.json',
			semanticMap: semanticMap({
				assignments: [
					assignment('label', {
						assignmentType: 'generated',
						sourceComponentIds: [],
					}),
				],
				parts: {
					label: {
						state: 'generated',
					},
				},
			}),
			layoutSvgPath: 'final-rendering-svgs/layout/b-1.svg',
			colorSvgPath: 'final-rendering-svgs/color/b-1.svg',
		});
		artifact.steps.layout = {
			status: 'ready',
			svg: 'final-rendering-svgs/layout/b-1.svg',
			viewBox: '0 0 94 136',
			parts: {
				label: {
					partId: 'label',
					status: 'ready',
					renderKind: 'generated',
					targetBounds: {
						left: 6,
						top: 8,
						width: 12,
						height: 20,
					},
				},
			},
		};

		const result = buildColorStep({
			artifact,
			normalizedComponents: normalizedArtifact('b-1', []),
			alignmentMap: alignmentMap([]),
			semanticMap: semanticMap(),
			referenceStructure: referenceStructure('b-1', {
				label: {
					role: 'suit-label',
					dominantColor: '#FC1D05',
				},
			}),
		});

		expect(result.step.status).toBe('ready');
		expect(result.step.parts.label).toEqual(jasmine.objectContaining({
			renderKind: 'generated',
			colorPolicy: 'generated',
			outputPaint: '#FC1D05',
		}));
		expect(result.svg).toContain('id="color-generated-parts"');
		expect(result.svg).toContain('fill="#FC1D05"');
		expect(result.svg).toContain('data-generated-text="1"');
	});

	it('writes final rendering artifacts, reports, and state updates', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const tilesetStatePath = path.resolve(BASE_OUTPUT, 'wiki', 'pipeline.json');
		const optionalPath = finalInputPath(output3dDir, 'wiki', 'optional-parts', 'b-1');
		const semanticPath = finalInputPath(output3dDir, 'wiki', 'semantic-map', 'b-1');
		const normalizedPath = finalInputPath(output3dDir, 'wiki', 'normalized-components', 'b-1');
		const alignmentPath = finalInputPath(output3dDir, 'wiki', 'alignment-map', 'b-1');
		const referenceStructurePath = path.resolve(BASE_REFERENCE, 'default-large-faces', 'reference.json');
		const outputPath = finalInputPath(output3dDir, 'wiki', 'final-rendering-map', 'b-1');
		const svgPath = path.resolve(BASE_OUTPUT, 'wiki', 'images', 'final-rendering-add-optional-svg', 'b-1.svg');
		const layoutSvgPath = path.resolve(BASE_OUTPUT, 'wiki', 'images', 'final-rendering-layout-svg', 'b-1.svg');
		const colorSvgPath = path.resolve(BASE_OUTPUT, 'wiki', 'images', 'final-rendering-color-svg', 'b-1.svg');
		const reportPath = path.resolve(BASE_OUTPUT, 'wiki', 'reports', 'final-rendering-composition-report.b-1.json');
		const updates = [];
		const fs = fakeFileSystem({
			[tilesetStatePath]: JSON.stringify({
				tilesetId: 'wiki',
				referenceSetId: 'default-large-faces',
				svgPipeline: {
					faces: {
						'b-1': {
						faceKey: 'b-1',
						state: {
							components: {},
							shapes: {},
							parts: {
								label: {
									partId: 'label',
									contentKind: 'label',
									role: 'suit-label',
									optional: true,
									accepted: true,
								},
							},
							bindings: {},
						},
						artifacts: {
							optionalPartAssignment: normalizeForTest(rootDir, optionalPath),
							semanticMap: normalizeForTest(rootDir, semanticPath),
							normalizedComponents: normalizeForTest(rootDir, normalizedPath),
							alignmentMap: normalizeForTest(rootDir, alignmentPath),
						},
						stages: {},
						},
					},
				},
				rendering: {
					defaults: {
						optionalParts: {
							outputPresent: true,
						},
						suits: {},
						faces: {},
					},
					overrides: {
						suits: {
							bamboo: {
								suitId: 'bamboo',
								parts: {
									label: {
										outputPresent: true,
									},
								},
							},
						},
						faces: {},
					},
				},
			}),
			[optionalPath]: JSON.stringify(optionalAssignment({
				faceKey: 'b-1',
				family: 'bamboo',
				optionalParts: {
					label: optionalPart('label', { sourceState: 'source-absent' }),
				},
			})),
			[semanticPath]: JSON.stringify(semanticMap({
				referenceSetId: 'default-large-faces',
				inputs: {
					referenceStructure: {
						path: normalizeForTest(rootDir, referenceStructurePath),
					},
				},
			})),
			[normalizedPath]: JSON.stringify(normalizedArtifact('b-1', [])),
			[alignmentPath]: JSON.stringify(alignmentMap([])),
			[referenceStructurePath]: JSON.stringify(referenceStructure('b-1', {
				label: {
					targetBounds: {
						left: 4,
						top: 6,
						width: 10,
						height: 18,
					},
				},
			})),
		});
		const runner = new FinalRenderingCompositionRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
		});

		const summary = await runner.run({
			tilesetId: 'wiki',
			faceKey: 'b-1',
		});
		const artifact = JSON.parse(fs.files.get(outputPath));
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual(jasmine.objectContaining({
			tilesetId: 'wiki',
			faceKey: 'b-1',
			faceCount: 1,
			generatedRenderCount: 0,
		}));
		expect(artifact.steps.addOptional.parts.label.renderKind).toBe('omit');
		expect(artifact.steps.addOptional.svg).toBe(normalizeForTest(rootDir, svgPath));
		expect(artifact.steps.layout.svg).toBe(normalizeForTest(rootDir, layoutSvgPath));
		expect(artifact.steps.color.svg).toBe(normalizeForTest(rootDir, colorSvgPath));
		expect(artifact.steps.layout.status).toBe('ready');
		expect(artifact.steps.color.status).toBe('ready');
		expect(fs.files.get(svgPath)).toContain('data-render-part-id="label" data-render-kind="omit"');
		expect(fs.files.get(svgPath)).not.toContain('data-generated-text="1"');
		expect(fs.files.get(svgPath)).not.toContain('data-generated-font="Gluten 800"');
		expect(fs.files.get(svgPath)).not.toContain('<text');
		expect(fs.files.get(layoutSvgPath)).toContain('viewBox="0 0 94 136"');
		expect(fs.files.get(colorSvgPath)).toContain('viewBox="0 0 94 136"');
		expect(fs.files.get(colorSvgPath)).toContain('id="color-generated-parts"');
		expect(report.faces['b-1']).toEqual(jasmine.objectContaining({
			status: 'ready',
			generatedRenderCount: 0,
			svgs: {
				addOptional: normalizeForTest(rootDir, svgPath),
				layout: normalizeForTest(rootDir, layoutSvgPath),
				color: normalizeForTest(rootDir, colorSvgPath),
			},
			pngs: {
				referenceLayoutColor: null,
			},
		}));
		expect(updates).toEqual([]);
		const updatedTileset = JSON.parse(fs.files.get(tilesetStatePath));
		expect(updatedTileset.svgPipeline.faces['b-1'].artifacts.finalRenderingMap).toBe(normalizeForTest(rootDir, outputPath));
		expect(updatedTileset.svgPipeline.faces['b-1'].artifacts.finalRenderingColorSvg).toBe(normalizeForTest(rootDir, colorSvgPath));
	});
});

function optionalAssignment({ faceKey, family, value = 1, optionalParts, outputOptions = null }) {
	return {
		schemaVersion: 1,
		tilesetId: 'wiki',
		faceKey,
		generatedOn: '2026-05-03T11:00:00.000Z',
		status: 'ready',
		face: {
			faceKey,
			family,
			value,
		},
		optionalParts,
		...(outputOptions ? { outputOptions } : {}),
	};
}

function renderingState({ defaults = {}, overrides = {} }) {
	return {
		rendering: {
			defaults: {
				optionalParts: {
					outputPresent: true,
				},
				...defaults,
			},
			overrides: {
				suits: {},
				faces: {},
				...overrides,
			},
		},
	};
}

function optionalPart(partId, overrides = {}) {
	return {
		partId,
		contentKind: 'label',
		role: 'suit-label',
		expected: true,
		sourceState: 'candidate-found',
		suggestedComponentIds: [],
		...overrides,
	};
}

function semanticMap(overrides = {}) {
	return {
		schemaVersion: 1,
		tilesetId: 'wiki',
		faceKey: 'b-1',
		referenceSetId: null,
		generatedOn: '2026-05-03T11:30:00.000Z',
		status: 'accepted',
		assignments: [],
		bindings: {},
		parts: {},
		...overrides,
	};
}

function assignment(partId, overrides = {}) {
	return {
		assignmentId: `assign.face.${partId}`,
		sourcePartId: partId,
		referencePartId: partId,
		contentKind: 'label',
		role: 'suit-label',
		assignmentType: 'source',
		sourceComponentIds: [],
		reviewStatus: 'accepted',
		...overrides,
	};
}

function normalizedArtifact(faceKey, components) {
	return {
		faceKey,
		viewBox: {
			minX: 0,
			minY: 0,
			width: 100,
			height: 140,
		},
		components,
	};
}

function normalizedComponent(componentId, pathData, overrides = {}) {
	return {
		componentId,
		pathData,
		fill: '#111111',
		stroke: null,
		className: null,
		transform: null,
		...overrides,
	};
}

function alignmentMap(candidates) {
	return {
		schemaVersion: 1,
		faceKey: 'd-8',
		candidates,
	};
}

function alignmentCandidate(alignmentId, {
	matrix,
	sourceComponentIds = [],
	referenceComponentIds = [],
	targetBounds = {
		left: 20,
		top: 30,
		width: 10,
		height: 10,
	},
	alignedBounds = {
		left: 20,
		top: 30,
		width: 10,
		height: 10,
	},
}) {
	return {
		alignmentId,
		sourceComponentIds,
		referenceComponentIds,
		transform: {
			matrix,
		},
		targetBounds,
		alignedBounds,
	};
}

function referenceStructure(faceKey, parts, components = []) {
	return {
		schemaVersion: 1,
		faces: {
			[faceKey]: {
				faceKey,
				parts,
				components,
			},
		},
	};
}

function referenceComponent(componentId, bounds, overrides = {}) {
	return {
		componentId,
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		dominantColor: null,
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
	};
}

function finalInputPath(output3dDir, tilesetId, stage, faceKey) {
	const segments = {
		'optional-parts': ['json', 'optional-parts'],
		'semantic-map': ['json', 'semantic-map'],
		'normalized-components': ['json', 'normalized-components'],
		'alignment-map': ['json', 'source-alignment'],
		'final-rendering-map': ['json', 'final-rendering-map'],
	}[stage] || ['json', stage];
	return path.resolve(BASE_OUTPUT, tilesetId, ...segments, `${faceKey}.json`);
}

function fakeFileSystem(initialFiles = {}) {
	const files = new Map(Object.entries(initialFiles));
	const directories = [];
	const writes = [];

	return {
		files,
		directories,
		writes,
		async access(filePath) {
			if (!files.has(filePath) && !directories.includes(filePath)) {
				throw new Error(`Missing fake file: ${filePath}`);
			}
		},
		async readFile(filePath) {
			if (!files.has(filePath)) {
				throw new Error(`Missing fake file: ${filePath}`);
			}
			return files.get(filePath);
		},
		async writeFile(filePath, content, encoding) {
			writes.push({ filePath, encoding });
			files.set(filePath, content);
		},
		async mkdir(dirPath) {
			directories.push(dirPath);
		},
		async readdir(dirPath) {
			const prefix = `${dirPath}${path.sep}`;
			return [...files.keys()]
				.filter((filePath) => filePath.startsWith(prefix))
				.map((filePath) => filePath.slice(prefix.length))
				.filter((name) => !name.includes(path.sep));
		},
	};
}

function normalizeForTest(rootDir, filePath) {
	return path.relative(rootDir, filePath).replaceAll('\\', '/');
}
