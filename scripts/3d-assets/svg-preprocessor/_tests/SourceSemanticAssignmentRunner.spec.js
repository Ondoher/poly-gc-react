import path from 'path';
import {
	SourceSemanticAssignmentRunner,
	assignSourceSemantics,
} from '../SourceSemanticAssignmentRunner.js';

describe('assignSourceSemantics', function() {
	it('creates source semantic bindings from alignment source part mappings', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			referenceSetId: 'test-reference',
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceFace: referenceFace(),
			referenceStructurePath: 'reference-structure.json',
			alignmentMapPath: 'alignment-map/flower-1.json',
			alignmentMap: alignmentMap('flower-1', [
				sourcePartMapping({
					mappingId: 'source-part-map.align.flower-1.label',
					sourcePartId: 'label',
					role: 'flower-label',
					contentKind: 'label',
					sourceComponentIds: ['src.flower-1.0001'],
					referencePartIds: ['label'],
					referenceComponentIds: ['ref-label'],
					alignmentIds: ['align.flower-1.01'],
				}),
				sourcePartMapping({
					mappingId: 'source-part-map.align.flower-1.mainArtwork',
					sourcePartId: 'mainArtwork',
					role: 'main-artwork',
					contentKind: 'artwork',
					sourceComponentIds: ['src.flower-1.0002', 'src.flower-1.0003'],
					referencePartIds: ['mainArtwork'],
					referenceComponentIds: ['ref-art'],
					alignmentIds: ['align.flower-1.02'],
				}),
			]),
		});

		expect(semanticMap.status).toBe('inferred');
		expect(semanticMap.bindings).toEqual({
			'src.flower-1.0001': tentativeBinding('label'),
			'src.flower-1.0002': tentativeBinding('mainArtwork'),
			'src.flower-1.0003': tentativeBinding('mainArtwork'),
		});
		expect(semanticMap.assignments).toEqual([
			jasmine.objectContaining({
				assignmentId: 'assign.flower-1.label',
				referencePartId: 'label',
				sourcePartId: 'label',
				globalPartId: 'flower.1.label',
				assignmentType: 'source',
				reviewStatus: 'inferred',
			}),
			jasmine.objectContaining({
				assignmentId: 'assign.flower-1.mainArtwork',
				referencePartId: 'mainArtwork',
				sourceComponentIds: ['src.flower-1.0002', 'src.flower-1.0003'],
				referenceComponentIds: ['ref-art'],
				alignmentIds: ['align.flower-1.02'],
			}),
		]);
		expect(semanticMap.diagnostics).toEqual([]);
	});

	it('preserves strong accepted optional label and glyph mapping strength', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			referenceSetId: 'test-reference',
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceFace: referenceFace(),
			referenceStructurePath: 'reference-structure.json',
			alignmentMapPath: 'alignment-map/flower-1.json',
			alignmentMap: alignmentMap('flower-1', [
				sourcePartMapping({
					mappingId: 'source-part-map.align.flower-1.label',
					sourcePartId: 'label',
					role: 'flower-label',
					contentKind: 'label',
					sourceComponentIds: ['src.flower-1.0001'],
					referencePartIds: ['label'],
					referenceComponentIds: ['ref-label'],
					alignmentIds: ['align.flower-1.01'],
					strength: 'strong',
					reviewStatus: 'reviewed',
				}),
				sourcePartMapping({
					mappingId: 'source-part-map.align.flower-1.glyph',
					sourcePartId: 'glyph',
					role: 'flower-character',
					contentKind: 'glyph',
					sourceComponentIds: ['src.flower-1.0002'],
					referencePartIds: ['glyph'],
					referenceComponentIds: ['ref-glyph'],
					alignmentIds: ['align.flower-1.02'],
					strength: 'strong',
					reviewStatus: 'reviewed',
				}),
			]),
		});

		expect(semanticMap.bindings['src.flower-1.0001']).toEqual(strongBinding('label', { source: 'layered-overlap' }));
		expect(semanticMap.bindings['src.flower-1.0002']).toEqual(strongBinding('glyph', { source: 'layered-overlap' }));
		expect(semanticMap.parts.label.strength).toBe('strong');
		expect(semanticMap.parts.glyph.strength).toBe('strong');
		expect(semanticMap.assignments).toEqual(jasmine.arrayContaining([
			jasmine.objectContaining({
				referencePartId: 'label',
				strength: 'strong',
				reviewStatus: 'reviewed',
			}),
			jasmine.objectContaining({
				referencePartId: 'glyph',
				strength: 'strong',
				reviewStatus: 'reviewed',
			}),
		]));
	});

	it('keeps generated skipped mappings as assignments without source bindings', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			alignmentMap: alignmentMap('flower-1', [
				sourcePartMapping({
					mappingId: 'source-part-map.align-group.flower-1.label',
					sourceComponentIds: [],
					referencePartIds: ['label'],
					matchStatus: 'skipped',
					strategy: 'not-applicable',
				}),
			]),
		});

		expect(semanticMap.status).toBe('needs-review');
		expect(semanticMap.bindings).toEqual({});
		expect(semanticMap.parts).toEqual({
			label: noPartBinding({
				source: 'not-applicable',
				reason: 'source-assignment-draft',
			}),
		});
		expect(semanticMap.assignments).toEqual([
			jasmine.objectContaining({
				assignmentType: 'source',
				referencePartId: 'label',
				sourceComponentIds: [],
			}),
		]);
	});

	it('preserves strong manual bindings when regenerated alignment has no mapping for that part', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceFace: referenceFace(),
			previousSemanticMap: {
				bindings: {
					'src.flower-1.manual-label': strongBinding('label'),
				},
				parts: {
					label: {
						state: 'bound',
						strength: 'strong',
						source: 'manual',
						reviewStatus: 'reviewed',
					},
				},
				assignments: [{
					assignmentId: 'assign.flower-1.label',
					sourcePartId: 'label',
					referencePartId: 'label',
					sourceComponentIds: ['src.flower-1.manual-label'],
					referenceComponentIds: ['ref-label'],
					assignmentType: 'source',
					strength: 'strong',
					strategy: 'manual',
					reviewStatus: 'reviewed',
				}],
			},
			alignmentMap: alignmentMap('flower-1', [
				sourcePartMapping({
					mappingId: 'source-part-map.align.flower-1.mainArtwork',
					sourcePartId: 'mainArtwork',
					role: 'main-artwork',
					contentKind: 'artwork',
					sourceComponentIds: ['src.flower-1.art'],
					referencePartIds: ['mainArtwork'],
					referenceComponentIds: ['ref-art'],
					alignmentIds: ['align.flower-1.art'],
				}),
			]),
		});

		expect(semanticMap.bindings['src.flower-1.manual-label']).toEqual(strongBinding('label'));
		expect(semanticMap.parts.label).toEqual(jasmine.objectContaining({
			state: 'bound',
			strength: 'strong',
			reviewStatus: 'reviewed',
		}));
		expect(semanticMap.assignments).toEqual(jasmine.arrayContaining([
			jasmine.objectContaining({
				referencePartId: 'label',
				sourceComponentIds: ['src.flower-1.manual-label'],
				strength: 'strong',
				strategy: 'manual',
				reviewStatus: 'reviewed',
				provenance: jasmine.objectContaining({
					source: 'manual-binding-preserved',
				}),
			}),
		]));
	});

	it('projects prebound optional mappings without relinking them', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceFace: referenceFace(),
			alignmentMap: alignmentMap('flower-1', [
				sourcePartMapping({
					mappingId: 'source-part-map.align.flower-1.label',
					sourcePartId: 'label',
					role: 'flower-label',
					contentKind: 'label',
					sourceComponentIds: ['src.flower-1.0009'],
					referencePartIds: ['label'],
					referenceComponentIds: ['ref-label'],
					alignmentIds: ['align.flower-1.label'],
					provenance: 'optional-part-reservation',
				}),
				sourcePartMapping({
					mappingId: 'source-part-map.align.flower-1.glyph',
					sourcePartId: 'glyph',
					role: 'flower-character',
					contentKind: 'glyph',
					sourceComponentIds: ['src.flower-1.0010.0001', 'src.flower-1.0010.0002'],
					referencePartIds: ['glyph'],
					referenceComponentIds: ['ref-glyph'],
					alignmentIds: ['align.flower-1.glyph'],
					provenance: 'optional-part-reservation',
				}),
				sourcePartMapping({
					mappingId: 'source-part-map.align.flower-1.mainArtwork',
					sourcePartId: 'mainArtwork',
					role: 'main-artwork',
					contentKind: 'artwork',
					sourceComponentIds: ['src.flower-1.0001'],
					referencePartIds: ['mainArtwork'],
					referenceComponentIds: ['ref-art'],
					alignmentIds: ['align.flower-1.mainArtwork'],
					provenance: 'alignment-candidate',
				}),
			]),
		});

		expect(semanticMap.status).toBe('inferred');
		expect(semanticMap.bindings).toEqual({
			'src.flower-1.0009': tentativeBinding('label'),
			'src.flower-1.0010.0001': tentativeBinding('glyph'),
			'src.flower-1.0010.0002': tentativeBinding('glyph'),
			'src.flower-1.0001': tentativeBinding('mainArtwork'),
		});
		expect(semanticMap.assignments).toEqual([
			jasmine.objectContaining({
				referencePartId: 'label',
				sourcePartId: 'label',
				role: 'flower-label',
				sourceComponentIds: ['src.flower-1.0009'],
				assignmentType: 'source',
				provenance: jasmine.objectContaining({
					source: 'alignment-source-part-mapping',
					mappingId: 'source-part-map.align.flower-1.label',
					mappingProvenance: 'optional-part-reservation',
				}),
			}),
			jasmine.objectContaining({
				referencePartId: 'glyph',
				sourcePartId: 'glyph',
				role: 'flower-character',
				sourceComponentIds: ['src.flower-1.0010.0001', 'src.flower-1.0010.0002'],
				assignmentType: 'source',
				provenance: jasmine.objectContaining({
					source: 'alignment-source-part-mapping',
					mappingId: 'source-part-map.align.flower-1.glyph',
					mappingProvenance: 'optional-part-reservation',
				}),
			}),
			jasmine.objectContaining({
				referencePartId: 'mainArtwork',
				sourcePartId: 'mainArtwork',
				sourceComponentIds: ['src.flower-1.0001'],
			}),
		]);
		expect(semanticMap.diagnostics).toEqual([]);
	});

	it('merges repeated mappings for one reference part into one source assignment', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'c-6',
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceFace: {
				parts: {
					glyph: {
						globalPartId: 'c-6:glyph',
						role: 'character-number-glyph',
						contentKind: 'glyph',
						componentIds: ['ref.c-6.0002', 'ref.c-6.0003', 'ref.c-6.0004'],
					},
				},
			},
			alignmentMap: alignmentMap('c-6', [
				sourcePartMapping({
					mappingId: 'source-part-map.align.c-6.glyph.1',
					sourcePartId: 'glyph',
					role: 'character-number-glyph',
					contentKind: 'glyph',
					sourceComponentIds: ['src.c-6.0011'],
					referencePartIds: ['glyph'],
					referenceComponentIds: ['ref.c-6.0002'],
					alignmentIds: ['align.c-6.glyph.1'],
				}),
				sourcePartMapping({
					mappingId: 'source-part-map.align.c-6.glyph.2',
					sourcePartId: 'glyph',
					role: 'character-number-glyph',
					contentKind: 'glyph',
					sourceComponentIds: ['src.c-6.0009'],
					referencePartIds: ['glyph'],
					referenceComponentIds: ['ref.c-6.0004'],
					alignmentIds: ['align.c-6.glyph.2'],
				}),
				sourcePartMapping({
					mappingId: 'source-part-map.align.c-6.glyph.3',
					sourcePartId: 'glyph',
					role: 'character-number-glyph',
					contentKind: 'glyph',
					sourceComponentIds: ['src.c-6.0010'],
					referencePartIds: ['glyph'],
					referenceComponentIds: ['ref.c-6.0003'],
					alignmentIds: ['align.c-6.glyph.3'],
				}),
			]),
		});

		expect(semanticMap.bindings).toEqual({
			'src.c-6.0011': tentativeBinding('glyph', { source: 'layered-overlap' }),
			'src.c-6.0009': tentativeBinding('glyph', { source: 'layered-overlap' }),
			'src.c-6.0010': tentativeBinding('glyph', { source: 'layered-overlap' }),
		});
		expect(semanticMap.assignments).toEqual([
			jasmine.objectContaining({
				assignmentId: 'assign.c-6.glyph',
				referencePartId: 'glyph',
				sourceComponentIds: ['src.c-6.0011', 'src.c-6.0009', 'src.c-6.0010'],
				referenceComponentIds: ['ref.c-6.0002', 'ref.c-6.0004', 'ref.c-6.0003'],
				alignmentIds: ['align.c-6.glyph.1', 'align.c-6.glyph.2', 'align.c-6.glyph.3'],
				assignmentType: 'source',
				provenance: jasmine.objectContaining({
					mappingId: 'source-part-map.align.c-6.glyph.1',
					mappingIds: [
						'source-part-map.align.c-6.glyph.1',
						'source-part-map.align.c-6.glyph.2',
						'source-part-map.align.c-6.glyph.3',
					],
				}),
			}),
		]);
		expect(semanticMap.summary.assignmentCount).toBe(1);
		expect(semanticMap.diagnostics).toEqual([]);
	});

	it('preserves a manually unbound repeated part instead of projecting a grouped mapping back onto it', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'b-2',
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceFace: {
				parts: {
					'bamboo.1': {
						globalPartId: 'b-2:bamboo.1',
						role: 'bamboo-stick',
						contentKind: 'artwork',
						componentIds: ['ref.b-2.0002'],
					},
					'bamboo.2': {
						globalPartId: 'b-2:bamboo.2',
						role: 'bamboo-stick',
						contentKind: 'artwork',
						componentIds: ['ref.b-2.0003'],
					},
				},
			},
			previousSemanticMap: {
				bindings: {
					'src.b-2.0009': strongBinding('bamboo.1'),
				},
				parts: {
					'bamboo.2': noPartBinding(),
				},
				assignments: [{
					assignmentId: 'assign.b-2.bamboo.2',
					referencePartId: 'bamboo.2',
					sourceComponentIds: [],
					assignmentType: 'source',
					reviewStatus: 'needs-review',
					unboundReason: 'source-assignment-draft',
				}],
			},
			alignmentMap: alignmentMap('b-2', [
				sourcePartMapping({
					mappingId: 'source-part-map.align.b-2.bamboo',
					sourcePartId: 'bamboo.1',
					role: 'bamboo-stick',
					contentKind: 'artwork',
					sourceComponentIds: ['src.b-2.0009'],
					referencePartIds: ['bamboo.1', 'bamboo.2'],
					referenceComponentIds: ['ref.b-2.0002', 'ref.b-2.0003'],
					alignmentIds: ['align.b-2.01'],
				}),
			]),
		});

		expect(semanticMap.status).toBe('needs-review');
		expect(semanticMap.bindings).toEqual({
			'src.b-2.0009': strongBinding('bamboo.1'),
		});
		expect(semanticMap.parts).toEqual(jasmine.objectContaining({
			'bamboo.2': noPartBinding(),
		}));
		expect(semanticMap.assignments).toEqual(jasmine.arrayContaining([
			jasmine.objectContaining({
				referencePartId: 'bamboo.1',
				sourceComponentIds: ['src.b-2.0009'],
				assignmentType: 'source',
			}),
			jasmine.objectContaining({
				referencePartId: 'bamboo.2',
				sourcePartId: 'bamboo.2',
				sourceComponentIds: [],
				assignmentType: 'source',
				reviewStatus: 'needs-review',
				unboundReason: 'manual',
				provenance: jasmine.objectContaining({
					source: 'part-state',
					blockedMappingId: 'source-part-map.align.b-2.bamboo',
				}),
			}),
		]));
	});

	it('rebinds a manually unbound repeated part when fresh alignment offers a free component', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'b-2',
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceFace: {
				parts: {
					'bamboo.2': {
						globalPartId: 'b-2:bamboo.2',
						role: 'bamboo-stick',
						contentKind: 'artwork',
						componentIds: ['ref.b-2.0003'],
					},
				},
			},
			previousSemanticMap: {
				bindings: {
					'src.b-2.0010': noPartBinding(),
				},
				parts: {
					'bamboo.2': noPartBinding(),
				},
			},
			alignmentMap: alignmentMap('b-2', [
				sourcePartMapping({
					mappingId: 'source-part-map.align.b-2.01.0002',
					sourcePartId: 'bamboo.2',
					role: 'bamboo-stick',
					contentKind: 'artwork',
					sourceComponentIds: ['src.b-2.0010'],
					referencePartIds: ['bamboo.2'],
					referenceComponentIds: ['ref.b-2.0003'],
					alignmentIds: ['align.b-2.01.0002'],
					strategy: 'gap',
				}),
			]),
		});

		expect(semanticMap.status).toBe('inferred');
		expect(semanticMap.bindings['src.b-2.0010']).toEqual(tentativeBinding('bamboo.2', {
			source: 'gap',
		}));
		expect(semanticMap.parts['bamboo.2']).toEqual(jasmine.objectContaining({
			state: 'bound',
			strength: 'tentative',
		}));
		expect(semanticMap.assignments).toEqual(jasmine.arrayContaining([
			jasmine.objectContaining({
				referencePartId: 'bamboo.2',
				sourceComponentIds: ['src.b-2.0010'],
				assignmentType: 'source',
				reviewStatus: 'inferred',
				strength: 'tentative',
			}),
		]));
	});

	it('marks mappings without source components as needing review', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'd-5',
			generatedOn: '2026-05-03T12:00:00.000Z',
			alignmentMap: alignmentMap('d-5', [
				sourcePartMapping({
					sourceComponentIds: [],
					referencePartIds: ['dot.1'],
					matchStatus: 'unmatched',
				}),
			]),
		});

		expect(semanticMap.status).toBe('needs-review');
		expect(semanticMap.assignments[0]).toEqual(jasmine.objectContaining({
			referencePartId: 'dot.1',
			reviewStatus: 'needs-review',
		}));
		expect(semanticMap.diagnostics).toEqual([
			jasmine.objectContaining({
				level: 'warning',
				code: 'unbound-source-assignment',
				referencePartId: 'dot.1',
			}),
		]);
	});

	it('diagnoses mappings that do not name a reference part', function() {
		const semanticMap = assignSourceSemantics({
			tilesetId: 'wiki',
			faceKey: 'd-5',
			generatedOn: '2026-05-03T12:00:00.000Z',
			alignmentMap: alignmentMap('d-5', [
				sourcePartMapping({
					mappingId: 'source-part-map.unresolved',
					sourceComponentIds: ['src.d-5.0001'],
					referencePartIds: [],
				}),
			]),
		});

		expect(semanticMap.status).toBe('needs-review');
		expect(semanticMap.assignments).toEqual([]);
		expect(semanticMap.diagnostics).toEqual([
			jasmine.objectContaining({
				level: 'warning',
				code: 'mapping-without-reference-part',
				mappingId: 'source-part-map.unresolved',
			}),
		]);
	});
});

describe('SourceSemanticAssignmentRunner', function() {
	it('writes semantic-map artifacts, reports, and state for one face', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const referenceStructurePath = path.resolve(rootDir, 'reference-structure.json');
		const pipelineStatePath = pipelineArtifactPath(output3dDir, 'wiki');
		const alignmentPath = alignmentArtifactPath(output3dDir, 'wiki', 'flower-1');
		const updates = [];
		const fs = fakeFileSystem({
			[referenceStructurePath]: JSON.stringify(referenceStructure(['flower-1'])),
			[pipelineStatePath]: JSON.stringify(pipelineState(rootDir, output3dDir, 'wiki', ['flower-1'], {
				sourcePartMappingsByFace: {
					'flower-1': [
						sourcePartMapping({
							sourceComponentIds: ['src.flower-1.0001'],
							referencePartIds: ['label'],
							referenceComponentIds: ['ref-label'],
						}),
					],
				},
			})),
			[alignmentPath]: JSON.stringify(alignmentMap('flower-1', [
				sourcePartMapping({
					sourceComponentIds: ['src.flower-1.0001'],
					referencePartIds: ['label'],
					referenceComponentIds: ['ref-label'],
				}),
			])),
		});
		const runner = new SourceSemanticAssignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
			updateState: (update) => updates.push(update),
		});

		const summary = await runner.run({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			referenceStructurePath,
		});

		const semanticPath = semanticArtifactPath(output3dDir, 'wiki', 'flower-1');
		const reportPath = path.resolve(output3dDir, 'svg-preprocessor', 'wiki', 'reports', 'source-semantic-assignment-report.flower-1.json');
		const artifact = JSON.parse(fs.files.get(semanticPath));
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			faceCount: 1,
			assignmentCount: 1,
			diagnosticCount: 0,
			warningCount: 0,
			pipelineStatePath: normalizeForTest(rootDir, pipelineStatePath),
			semanticMapDir: normalizeForTest(rootDir, path.dirname(semanticPath)),
			reportPath: normalizeForTest(rootDir, reportPath),
		});
		expect(artifact.bindings).toEqual({
			'src.flower-1.0001': tentativeBinding('label'),
		});
		expect(report.faces['flower-1']).toEqual(jasmine.objectContaining({
			status: 'inferred',
			assignmentCount: 1,
			bindingCount: 1,
			artifact: normalizeForTest(rootDir, semanticPath),
		}));
		const updatedPipeline = JSON.parse(fs.files.get(pipelineStatePath));
		expect(updatedPipeline.artifacts.sourceSemanticAssignmentReport).toBe(normalizeForTest(rootDir, reportPath));
		expect(updatedPipeline.faces['flower-1'].artifacts.semanticMap).toBe(normalizeForTest(rootDir, semanticPath));
		expect(updatedPipeline.faces['flower-1'].state.bindings['src.flower-1.0001']).toEqual(jasmine.objectContaining({
			componentId: 'src.flower-1.0001',
			partId: 'label',
			strength: 'tentative',
			semanticAssignmentId: 'assign.flower-1.label',
		}));
		expect(updatedPipeline.faces['flower-1'].state.parts.label.reviewStatus).toBeUndefined();
		expect(updates).toEqual([jasmine.objectContaining({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			generatedOn: '2026-05-03T12:00:00.000Z',
			stages: {
				semanticAssignment: jasmine.objectContaining({
					status: 'inferred',
					artifact: normalizeForTest(rootDir, semanticPath),
					assignmentCount: 1,
					bindingCount: 1,
					diagnosticCount: 0,
				}),
			},
		})]);
		expect(fs.writes.filter((write) => [semanticPath, reportPath].includes(write.filePath))
			.every((write) => write.encoding === 'utf8')).toBe(true);
	});

	it('does not downgrade accepted optional bindings during canonical state refresh', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const referenceStructurePath = path.resolve(rootDir, 'reference-structure.json');
		const pipelineStatePath = pipelineArtifactPath(output3dDir, 'wiki');
		const alignmentPath = alignmentArtifactPath(output3dDir, 'wiki', 'flower-1');
		const state = pipelineState(rootDir, output3dDir, 'wiki', ['flower-1'], {
			sourcePartMappingsByFace: {
				'flower-1': [
					sourcePartMapping({
						sourceComponentIds: ['src.flower-1.0001'],
						referencePartIds: ['label'],
						referenceComponentIds: ['ref-label'],
						strength: 'strong',
						reviewStatus: 'reviewed',
					}),
				],
			},
		});
		state.faces['flower-1'].state.parts.label.reviewStatus = 'accepted';
		state.faces['flower-1'].state.parts.label.acceptedOn = '2026-05-03T10:00:00.000Z';
		state.faces['flower-1'].state.bindings['src.flower-1.0001'] = {
			componentId: 'src.flower-1.0001',
			partId: 'label',
			strength: 'accepted',
			reviewStatus: 'accepted',
			source: 'optional-part-assignment',
		};
		const fs = fakeFileSystem({
			[referenceStructurePath]: JSON.stringify(referenceStructure(['flower-1'])),
			[pipelineStatePath]: JSON.stringify(state),
			[alignmentPath]: JSON.stringify(alignmentMap('flower-1', [
				sourcePartMapping({
					sourceComponentIds: ['src.flower-1.0001'],
					referencePartIds: ['label'],
					referenceComponentIds: ['ref-label'],
					strength: 'strong',
					reviewStatus: 'reviewed',
				}),
			])),
		});
		const runner = new SourceSemanticAssignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
		});

		await runner.run({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			referenceStructurePath,
		});

		const updatedPipeline = JSON.parse(fs.files.get(pipelineStatePath));
		expect(updatedPipeline.faces['flower-1'].state.bindings['src.flower-1.0001']).toEqual(jasmine.objectContaining({
			strength: 'accepted',
			reviewStatus: 'accepted',
		}));
		expect(updatedPipeline.faces['flower-1'].state.parts.label).toEqual(jasmine.objectContaining({
			reviewStatus: 'accepted',
			acceptedOn: '2026-05-03T10:00:00.000Z',
		}));
	});

	it('limits processing to the requested face key', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const referenceStructurePath = path.resolve(rootDir, 'reference-structure.json');
		const pipelineStatePath = pipelineArtifactPath(output3dDir, 'wiki');
		const fs = fakeFileSystem({
			[referenceStructurePath]: JSON.stringify(referenceStructure(['flower-1', 'flower-2'])),
			[pipelineStatePath]: JSON.stringify(pipelineState(rootDir, output3dDir, 'wiki', ['flower-1', 'flower-2'])),
			[alignmentArtifactPath(output3dDir, 'wiki', 'flower-1')]: JSON.stringify(alignmentMap('flower-1')),
			[alignmentArtifactPath(output3dDir, 'wiki', 'flower-2')]: JSON.stringify(alignmentMap('flower-2')),
		});
		const runner = new SourceSemanticAssignmentRunner({ fileSystem: fs, rootDir, output3dDir });

		await runner.run({
			tilesetId: 'wiki',
			faceKey: 'flower-2',
			referenceStructurePath,
		});

		const reportPath = path.resolve(output3dDir, 'svg-preprocessor', 'wiki', 'reports', 'source-semantic-assignment-report.flower-2.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(fs.files.has(semanticArtifactPath(output3dDir, 'wiki', 'flower-1'))).toBe(false);
		expect(fs.files.has(semanticArtifactPath(output3dDir, 'wiki', 'flower-2'))).toBe(true);
		expect(Object.keys(report.faces)).toEqual(['flower-2']);
	});

	it('records missing alignment maps as report warnings and state diagnostics', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const referenceStructurePath = path.resolve(rootDir, 'reference-structure.json');
		const pipelineStatePath = pipelineArtifactPath(output3dDir, 'wiki');
		const updates = [];
		const fs = fakeFileSystem({
			[referenceStructurePath]: JSON.stringify(referenceStructure(['wind-n'])),
			[pipelineStatePath]: JSON.stringify(pipelineState(rootDir, output3dDir, 'wiki', ['wind-n'], {
				includeAlignmentArtifact: false,
			})),
		});
		const runner = new SourceSemanticAssignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			updateState: (update) => updates.push(update),
		});

		const summary = await runner.run({
			tilesetId: 'wiki',
			referenceStructurePath,
		});
		const reportPath = path.resolve(output3dDir, 'svg-preprocessor', 'wiki', 'reports', 'source-semantic-assignment-report.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary.assignmentCount).toBe(0);
		expect(summary.warningCount).toBe(1);
		expect(report.warnings).toEqual([{
			faceKey: 'wind-n',
			code: 'missing-alignment-stage',
			message: 'No alignment stage state exists for wind-n.',
		}]);
		expect(updates).toEqual([jasmine.objectContaining({
			tilesetId: 'wiki',
			faceKey: 'wind-n',
			stages: {
				semanticAssignment: jasmine.objectContaining({
					status: 'missing-alignment-stage',
					diagnostics: [jasmine.objectContaining({ code: 'missing-alignment-stage' })],
				}),
			},
		})]);
	});
});

function fakeFileSystem(initialFiles = {}) {
	const files = new Map(Object.entries(initialFiles));
	const writes = [];

	return {
		files,
		writes,
		async access(filePath) {
			if (!files.has(filePath)) {
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
		async mkdir() {},
	};
}

function referenceStructure(faceKeys) {
	return {
		referenceSet: {
			referenceSetId: 'test-reference',
		},
		faces: Object.fromEntries(faceKeys.map((faceKey) => [faceKey, referenceFace()])),
	};
}

function referenceFace() {
	return {
		parts: {
			label: {
				globalPartId: 'flower.1.label',
				role: 'flower-label',
				contentKind: 'label',
				componentIds: ['ref-label'],
			},
			glyph: {
				globalPartId: 'flower.1.glyph',
				role: 'flower-character',
				contentKind: 'glyph',
				componentIds: ['ref-glyph'],
			},
			mainArtwork: {
				globalPartId: 'flower.1.mainArtwork',
				role: 'main-artwork',
				contentKind: 'artwork',
				componentIds: ['ref-art'],
			},
		},
	};
}

function alignmentMap(faceKey, sourcePartMappings = [
	sourcePartMapping({
		sourceComponentIds: ['src.source.0001'],
		referencePartIds: ['label'],
		referenceComponentIds: ['ref-label'],
	}),
]) {
	return {
		schemaVersion: 1,
		tilesetId: 'wiki',
		faceKey,
		referenceSetId: 'test-reference',
		generatedOn: '2026-05-03T11:00:00.000Z',
		status: 'inferred',
		sourcePartMappings,
	};
}

function sourcePartMapping(overrides = {}) {
	return {
		mappingId: 'source-part-map.align.test.0001',
		sourcePartId: 'label',
		role: 'flower-label',
		contentKind: 'label',
		sourceComponentIds: ['src.source.0001'],
		referencePartIds: ['label'],
		referenceComponentIds: ['ref-label'],
		alignmentGroupId: 'align-group.test.label',
		alignmentIds: ['align.test.0001'],
		alignmentCandidateId: 'align.test.0001',
		matchStatus: 'matched',
		strategy: 'layered-overlap',
		score: 1.5,
		scoreKind: 'penalty-lower-is-better',
		identityResolver: { type: 'direct' },
		reviewStatus: 'inferred',
		provenance: 'alignment-candidate',
		...overrides,
	};
}

function alignmentArtifactPath(output3dDir, tilesetId, faceKey) {
	return path.resolve(output3dDir, 'svg-preprocessor', tilesetId, 'alignment-map', `${faceKey}.json`);
}

function semanticArtifactPath(output3dDir, tilesetId, faceKey) {
	return path.resolve(output3dDir, 'svg-preprocessor', tilesetId, 'semantic-map', `${faceKey}.json`);
}

function pipelineArtifactPath(output3dDir, tilesetId) {
	return path.resolve(output3dDir, 'svg-preprocessor', tilesetId, 'tileset.json');
}

function pipelineState(rootDir, output3dDir, tilesetId, faceKeys, options = {}) {
	const includeAlignmentArtifact = options.includeAlignmentArtifact !== false;
	const sourcePartMappingsByFace = options.sourcePartMappingsByFace || {};

	return {
		schemaVersion: 1,
		tilesetId,
		faces: Object.fromEntries(faceKeys.map((faceKey) => [faceKey, {
			state: {
				components: {},
				shapes: {},
				parts: referenceFace().parts,
				bindings: includeAlignmentArtifact
					? bindingsFromMappings(sourcePartMappingsByFace[faceKey] || alignmentMap(faceKey).sourcePartMappings)
					: {},
			},
			artifacts: {
				...(includeAlignmentArtifact
					? { alignmentMap: normalizeForTest(rootDir, alignmentArtifactPath(output3dDir, tilesetId, faceKey)) }
					: {}),
			},
			stages: {
				...(includeAlignmentArtifact
					? { alignment: { status: 'inferred', updatedOn: '2026-05-03T12:00:00.000Z' } }
					: {}),
			},
		}])),
		artifacts: {},
	};
}

function bindingsFromMappings(mappings) {
	return Object.fromEntries((mappings || []).flatMap((mapping) => {
		const partId = mapping.referencePartIds?.[0] || mapping.sourcePartId;

		return (mapping.sourceComponentIds || []).map((componentId) => [componentId, {
			componentId,
			partId,
			source: mapping.strategy || 'layered-overlap',
			strength: mapping.strength || 'tentative',
			reviewStatus: mapping.reviewStatus || 'inferred',
		}]);
	}));
}

function tentativeBinding(partId, overrides = {}) {
	return {
		partId,
		source: 'layered-overlap',
		strength: 'tentative',
		reviewStatus: 'inferred',
		...overrides,
	};
}

function strongBinding(partId, overrides = {}) {
	return {
		partId,
		source: 'manual',
		strength: 'strong',
		reviewStatus: 'reviewed',
		...overrides,
	};
}

function noPartBinding(overrides = {}) {
	return {
		state: 'unbound',
		strength: 'none',
		source: 'source-part-state',
		reviewStatus: 'needs-review',
		reason: 'manual',
		...overrides,
	};
}

function generatedPart(overrides = {}) {
	return {
		state: 'generated',
		strength: 'none',
		source: 'not-applicable',
		reviewStatus: 'inferred',
		...overrides,
	};
}

function normalizeForTest(rootDir, filePath) {
	return path.relative(rootDir, filePath).replaceAll(path.sep, '/');
}
