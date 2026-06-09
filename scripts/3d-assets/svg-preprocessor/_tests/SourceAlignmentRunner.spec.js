import path from 'path';
import { BASE_OUTPUT } from '../PipelineModel.js';
import { SourceAlignmentRunner, alignFace } from '../SourceAlignmentRunner.js';
import { testPipelineModelFromFile } from './test-pipeline-model.js';

describe('SourceAlignmentRunner', function() {
	it('writes alignment artifacts, reports, and state updates from mocked dependencies', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const normalizedPath = alignmentInputPath(output3dDir, 'wiki', 'flower-1', 'normalized-components');
		const optionalPath = alignmentInputPath(output3dDir, 'wiki', 'flower-1', 'optional-parts');
		const stateUpdates = [];
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure('flower-1')),
			[normalizedPath]: JSON.stringify(normalizedFace('flower-1', [
				component('label-source', box(4, 4, 14, 20)),
				component('glyph-source', box(78, 4, 96, 28)),
				component('art-source', box(25, 45, 85, 125)),
			])),
			[optionalPath]: JSON.stringify(optionalAssignment('flower-1', {
				label: ['label-source'],
				glyph: ['glyph-source'],
			})),
		});
		const runner = new SourceAlignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			loadMetadata: () => ({}),
			updateState: (update) => stateUpdates.push(update),
			clock: () => '2026-05-03T12:00:00.000Z',
		});

		const summary = await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			referenceStructurePath: referencePath,
		});
		const artifactPath = alignmentInputPath(output3dDir, 'wiki', 'flower-1', 'alignment-map');
		const reportPath = path.resolve(BASE_OUTPUT, 'wiki', 'reports', 'source-alignment-report.flower-1.json');
		const artifact = JSON.parse(fs.files.get(artifactPath));
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual(jasmine.objectContaining({
			tilesetId: 'wiki',
			faceCount: 1,
			faceKey: 'flower-1',
			alignmentGroupCount: 3,
			candidateCount: 3,
			warningCount: 0,
		}));
		expect(artifact.inputs.optionalPartAssignment).toEqual(jasmine.objectContaining({
			path: jasmine.stringMatching(/asset-pipeline\/wiki\/pipeline\.json$/),
			status: 'canonical',
		}));
		expect(artifact.sourcePartMappings).toEqual([
			jasmine.objectContaining({
				sourcePartId: 'label',
				role: 'flower-label',
				contentKind: 'label',
				sourceComponentIds: ['label-source'],
				referencePartIds: ['label'],
				referenceComponentIds: ['ref-label'],
				alignmentCandidateId: 'align.flower-1.01.0001',
				provenance: 'alignment-candidate',
				matchStatus: 'matched',
			}),
			jasmine.objectContaining({
				sourcePartId: 'glyph',
				role: 'flower-character',
				contentKind: 'glyph',
				sourceComponentIds: ['glyph-source'],
				referencePartIds: ['glyph'],
				referenceComponentIds: ['ref-glyph'],
				alignmentCandidateId: 'align.flower-1.02.0001',
				provenance: 'alignment-candidate',
				matchStatus: 'matched',
			}),
			jasmine.objectContaining({
				sourcePartId: 'mainArtwork',
				role: 'main-artwork',
				contentKind: 'artwork',
				sourceComponentIds: ['art-source'],
				referencePartIds: ['mainArtwork'],
				referenceComponentIds: ['ref-art'],
				alignmentCandidateId: 'align.flower-1.03.0001',
				provenance: 'alignment-candidate',
				matchStatus: 'matched-freeform-artwork',
			}),
		]);
		expect(report.faces['flower-1']).toEqual(jasmine.objectContaining({
			status: 'inferred',
			alignmentGroupCount: 3,
			candidateCount: 3,
		}));
		expect(stateUpdates).toEqual([jasmine.objectContaining({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			stages: {
				alignment: jasmine.objectContaining({
					status: 'inferred',
					alignmentGroupCount: 3,
					candidateCount: 3,
				}),
			},
		})]);
		expect(fs.writes).toEqual(jasmine.arrayContaining([
			jasmine.objectContaining({ filePath: artifactPath, encoding: 'utf8' }),
			jasmine.objectContaining({ filePath: reportPath, encoding: 'utf8' }),
		]));
	});

	it('records missing normalized artifacts without writing an alignment map', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure('flower-1')),
		});
		const runner = new SourceAlignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			loadMetadata: () => ({}),
			updateState: (update) => stateUpdates.push(update),
			clock: () => '2026-05-03T12:00:00.000Z',
		});

		const summary = await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			referenceStructurePath: referencePath,
		});
		const artifactPath = alignmentInputPath(output3dDir, 'wiki', 'flower-1', 'alignment-map');
		const reportPath = path.resolve(BASE_OUTPUT, 'wiki', 'reports', 'source-alignment-report.flower-1.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual(jasmine.objectContaining({
			faceCount: 1,
			alignmentGroupCount: 0,
			candidateCount: 0,
			warningCount: 1,
		}));
		expect(fs.files.has(artifactPath)).toBe(false);
		expect(report.warnings).toEqual([jasmine.objectContaining({
			code: 'missing-normalized-components',
			faceKey: 'flower-1',
		})]);
		expect(stateUpdates).toEqual([jasmine.objectContaining({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			stages: {
				alignment: jasmine.objectContaining({
					status: 'missing-normalized-components',
				}),
			},
		})]);
	});

	it('processes full runs in sorted face-key order', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(['flower-2', 'flower-1', 'flower-3'])),
			...alignmentInputs(output3dDir, 'wiki', 'flower-1'),
			...alignmentInputs(output3dDir, 'wiki', 'flower-2'),
			...alignmentInputs(output3dDir, 'wiki', 'flower-3'),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates });

		const summary = await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			referenceStructurePath: referencePath,
		});

		expect(summary).toEqual(jasmine.objectContaining({
			faceCount: 3,
			alignmentGroupCount: 9,
			candidateCount: 9,
		}));
		expect(stateUpdates.map((update) => update.faceKey)).toEqual(['flower-1', 'flower-2', 'flower-3']);
	});

	it('aligns source shapes as atomic units while preserving component ids', function() {
		const faceKey = 'flower-1';
		const structure = referenceStructure(faceKey);
		const components = [
			component('label-source', box(4, 4, 14, 20)),
			component('glyph-outer', box(76, 5, 96, 30)),
			component('glyph-inner', box(80, 9, 92, 26)),
			component('art-source', box(25, 45, 85, 125)),
		];
		const normalized = normalizedFace(faceKey, components);

		normalized.sourceShapes = [
			sourceShape('shape.label', ['label-source'], box(4, 4, 14, 20)),
			sourceShape('shape.glyph', ['glyph-outer', 'glyph-inner'], box(76, 5, 96, 30)),
			sourceShape('shape.art', ['art-source'], box(25, 45, 85, 125)),
		];
		normalized.alignmentShapeIds = normalized.sourceShapes.map((shape) => shape.shapeId);

		const artifact = alignFace({
			tilesetId: 'wiki',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure: structure,
			referenceFace: structure.faces[faceKey],
			referenceStructurePath: 'reference.json',
			normalizedFace: normalized,
			normalizedPath: 'normalized.json',
			optionalAssignment: optionalAssignment(faceKey, {
				label: ['label-source'],
				glyph: ['glyph-inner'],
			}),
			optionalAssignmentPath: 'optional.json',
			semanticMap: semanticMapFromOptionalParts({
				label: ['label-source'],
				glyph: ['glyph-inner'],
			}),
			semanticMapPath: 'tileset.json',
			faceMetadata: null,
		});
		const glyphCandidate = artifact.candidates.find((candidate) => candidate.referencePartCandidates.includes('glyph'));

		expect(glyphCandidate.sourceShapeIds).toEqual(['shape.glyph']);
		expect(glyphCandidate.sourceComponentIds).toEqual(['glyph-outer', 'glyph-inner']);
		expect(artifact.diagnostics).not.toEqual(jasmine.arrayContaining([
			jasmine.objectContaining({ code: 'unmatched-source-components' }),
		]));
	});

	it('filters to the requested face and writes the single-face report name', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(['flower-1', 'flower-2'])),
			...alignmentInputs(output3dDir, 'wiki', 'flower-2'),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates });

		const summary = await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey: 'flower-2',
			referenceStructurePath: referencePath,
		});
		const reportPath = path.resolve(BASE_OUTPUT, 'wiki', 'reports', 'source-alignment-report.flower-2.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary.faceKey).toBe('flower-2');
		expect(stateUpdates.map((update) => update.faceKey)).toEqual(['flower-2']);
		expect(Object.keys(report.faces)).toEqual(['flower-2']);
		expect(fs.files.has(alignmentInputPath(output3dDir, 'wiki', 'flower-1', 'alignment-map'))).toBe(false);
		expect(fs.files.has(reportPath)).toBe(true);
	});

	it('targets split same-part candidates to their reference component bounds', function() {
		const faceKey = 'c-3';
		const reference = {
			referenceSet: {
				referenceSetId: 'test-reference',
				coordinateSpace: {
					preparedViewBox: [0, 0, 100, 100],
				},
			},
			faces: {
				[faceKey]: {
					image: { width: 100, height: 100 },
					parts: {
						glyph: referencePart('character-number-glyph', 'glyph', ['ref-top', 'ref-bottom'], box(0, 0, 100, 100)),
					},
					components: [
						referenceComponent('ref-top', box(10, 10, 30, 30), { partIds: ['glyph'] }),
						referenceComponent('ref-bottom', box(10, 50, 80, 70), { partIds: ['glyph'] }),
					],
				},
			},
		};

		const artifact = alignFace({
			tilesetId: 'wiki',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure: reference,
			referenceFace: reference.faces[faceKey],
			referenceStructurePath: 'reference-structure.json',
			normalizedFace: normalizedFace(faceKey, [
				component('source-top', box(10, 10, 30, 30)),
				component('source-bottom', box(10, 50, 80, 70)),
			]),
			normalizedPath: 'normalized-components/c-3.json',
			optionalAssignment: optionalAssignment(faceKey, {
				glyph: ['source-top', 'source-bottom'],
			}),
			optionalAssignmentPath: 'optional-parts/c-3.json',
			semanticMap: semanticMapFromOptionalParts({
				glyph: ['source-top', 'source-bottom'],
			}),
			semanticMapPath: 'tileset.json',
			faceMetadata: {},
		});

		expect(artifact.candidates.length).toBe(2);
		expect(artifact.candidates[0].targetBounds).toEqual(jasmine.objectContaining({
			left: 10,
			top: 10,
			right: 30,
			bottom: 30,
		}));
		expect(artifact.candidates[1].targetBounds).toEqual(jasmine.objectContaining({
			left: 10,
			top: 50,
			right: 80,
			bottom: 70,
		}));
		expect(artifact.candidates[0].targetBounds).not.toEqual(reference.faces[faceKey].parts.glyph.targetBounds);
	});

	it('writes split same-part mappings as bindings without canonical placements', async function() {
		const faceKey = 'flower-1';
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const normalizedPath = alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components');
		const optionalPath = alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts');
		const pipelineStatePath = path.resolve(BASE_OUTPUT, 'wiki', 'pipeline.json');
		const reference = {
			referenceSet: {
				referenceSetId: 'test-reference',
				coordinateSpace: {
					preparedViewBox: [0, 0, 100, 100],
				},
			},
			faces: {
				[faceKey]: {
					image: { width: 100, height: 100 },
					parts: {
						glyph: referencePart('flower-character', 'glyph', ['ref-top', 'ref-bottom'], box(0, 0, 100, 100)),
					},
					components: [
						referenceComponent('ref-top', box(10, 10, 30, 30), { partIds: ['glyph'] }),
						referenceComponent('ref-bottom', box(10, 50, 80, 70), { partIds: ['glyph'] }),
					],
				},
			},
		};
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(reference),
			[normalizedPath]: JSON.stringify(normalizedFace(faceKey, [
				component('source-top', box(10, 10, 30, 30)),
				component('source-bottom', box(10, 50, 80, 70)),
			])),
			[optionalPath]: JSON.stringify(optionalAssignment(faceKey, {
				glyph: ['source-top', 'source-bottom'],
			})),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const pipelineState = JSON.parse(fs.files.get(pipelineStatePath));
		const state = pipelineState.svgPipeline.faces[faceKey].state;

		expect(state.placements).toBeUndefined();
		expect(state.parts.glyph).toEqual(jasmine.objectContaining({
			alignmentSourceBounds: jasmine.objectContaining({
				left: 10,
				top: 10,
				right: 80,
				bottom: 70,
			}),
			alignmentTargetBounds: jasmine.objectContaining({
				left: 10,
				top: 10,
				right: 80,
				bottom: 70,
			}),
			alignmentTransform: jasmine.objectContaining({
				matrix: jasmine.any(Array),
			}),
		}));
		expect(state.bindings['source-top']).toEqual(jasmine.objectContaining({
			partId: 'glyph',
			strength: 'tentative',
		}));
		expect(state.bindings['source-bottom']).toEqual(jasmine.objectContaining({
			partId: 'glyph',
			strength: 'tentative',
		}));
	});

	it('writes a needs-review alignment map when the optional-part artifact is missing', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(defaultNormalizedFace(faceKey)),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifactPath = alignmentInputPath(output3dDir, 'wiki', faceKey, 'alignment-map');
		const artifact = JSON.parse(fs.files.get(artifactPath));

		expect(artifact.status).toBe('inferred');
		expect(artifact.inputs.optionalPartAssignment).toEqual(jasmine.objectContaining({
			status: 'canonical',
		}));
		expect(artifact.diagnostics).toEqual([]);
		expect(stateUpdates[0].stages.alignment).toEqual(jasmine.objectContaining({
			status: 'inferred',
			diagnosticCount: 0,
		}));
	});

	it('writes a needs-review alignment map when the optional-part artifact is not ready', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(defaultNormalizedFace(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(optionalAssignment(faceKey, {
				label: ['label-source'],
				glyph: ['glyph-source'],
			}, { status: 'needs-review' })),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifact = alignmentStage(fs, output3dDir, 'wiki', faceKey);

		expect(artifact.status).toBe('inferred');
		expect(artifact.inputs.optionalPartAssignment.status).toBe('canonical');
		expect(artifact.diagnostics).toEqual([]);
		expect(stateUpdates[0].stages.alignment).toEqual(jasmine.objectContaining({
			status: 'inferred',
			diagnosticCount: 0,
		}));
	});

	it('passes metadata paths through the loader and uses per-face metadata during alignment', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const metadataPath = path.resolve(rootDir, 'metadata.json');
		const loadedMetadataPaths = [];
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructureWithGlyphOnly(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(normalizedFace(faceKey, [
				component('glyph-from-metadata', box(78, 4, 96, 28)),
				component('other-source', box(25, 45, 85, 125)),
			])),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(optionalAssignment(faceKey, {})),
		});
		const runner = new SourceAlignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			loadMetadata: (loadedPath) => {
				loadedMetadataPaths.push(loadedPath);
				return {
					[faceKey]: {
						glyphLayout: {
							character: {
								sourcePresent: true,
								sourceBounds: box(78, 4, 96, 28),
							},
						},
					},
				};
			},
			updateState: () => {},
			clock: () => '2026-05-03T12:00:00.000Z',
		});

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
			metadataPath,
		});
		const artifact = alignmentStage(fs, output3dDir, 'wiki', faceKey);

		expect(loadedMetadataPaths).toEqual([metadataPath]);
		expect(artifact.alignmentGroups[0].sourceComponentIds).toEqual(['glyph-from-metadata']);
	});

	it('uses the requested tileset id for normalized input and alignment output scope', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const tilesetId = 'custom-set';
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			...alignmentInputs(output3dDir, tilesetId, faceKey),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		const summary = await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId,
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifactPath = alignmentInputPath(output3dDir, tilesetId, faceKey, 'alignment-map');

		expect(summary.tilesetId).toBe(tilesetId);
		expect(fs.files.has(artifactPath)).toBe(true);
		expect(fs.files.has(alignmentInputPath(output3dDir, 'wiki', faceKey, 'alignment-map'))).toBe(false);
	});

	it('aggregates report totals across processed faces', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(['flower-1', 'flower-2'])),
			...alignmentInputs(output3dDir, 'wiki', 'flower-1'),
			...alignmentInputs(output3dDir, 'wiki', 'flower-2'),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		const summary = await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			referenceStructurePath: referencePath,
		});
		const reportPath = path.resolve(BASE_OUTPUT, 'wiki', 'reports', 'source-alignment-report.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual(jasmine.objectContaining({
			faceCount: 2,
			alignmentGroupCount: 6,
			candidateCount: 6,
		}));
		expect(report.alignmentGroupCount).toBe(6);
		expect(report.candidateCount).toBe(6);
		expect(Object.keys(report.faces)).toEqual(['flower-1', 'flower-2']);
	});

	it('records detailed needs-review state updates from alignment diagnostics', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(defaultNormalizedFace(faceKey)),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifactPath = alignmentInputPath(output3dDir, 'wiki', faceKey, 'alignment-map');

		expect(stateUpdates).toEqual([jasmine.objectContaining({
			tilesetId: 'wiki',
			faceKey,
			stages: {
				alignment: jasmine.objectContaining({
					status: 'inferred',
					artifact: jasmine.stringMatching(/asset-pipeline\/wiki\/json\/source-alignment\/flower-1\.json$/),
					alignmentGroupCount: 3,
					candidateCount: 3,
					diagnosticCount: 0,
				}),
			},
		})]);
		expect(fs.files.has(artifactPath)).toBe(true);
	});

	it('writes an empty full-run report for an empty reference structure', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify({
				referenceSet: {
					referenceSetId: 'test-reference',
				},
				faces: {},
			}),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates });

		const summary = await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			referenceStructurePath: referencePath,
		});
		const reportPath = path.resolve(BASE_OUTPUT, 'wiki', 'reports', 'source-alignment-report.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual(jasmine.objectContaining({
			faceCount: 0,
			alignmentGroupCount: 0,
			candidateCount: 0,
			warningCount: 0,
		}));
		expect(report.faces).toEqual({});
		expect(stateUpdates).toEqual([]);
	});

	it('writes needs-review when normalized components contain no alignment components', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const faceKey = 'flower-1';
		const normalized = defaultNormalizedFace(faceKey);
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify({
				...normalized,
				alignmentComponentIds: [],
			}),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(optionalAssignment(faceKey, {
				label: ['label-source'],
				glyph: ['glyph-source'],
			})),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifact = alignmentStage(fs, output3dDir, 'wiki', faceKey);

		expect(artifact.status).toBe('needs-review');
		expect(artifact.diagnostics).toEqual(jasmine.arrayContaining([jasmine.objectContaining({
			code: 'empty-source-group',
			alignmentGroupId: 'align-group.flower-1.mainArtwork',
		})]));
		expect(stateUpdates[0].stages.alignment).toEqual(jasmine.objectContaining({
			status: 'needs-review',
			diagnosticCount: 2,
		}));
	});

	it('continues with ready optional-part artifacts that have absent optional parts and no reservations', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(defaultNormalizedFace(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(absentOptionalAssignment(faceKey, ['label', 'glyph'])),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifact = alignmentStage(fs, output3dDir, 'wiki', faceKey);

		expect(artifact.inputs.optionalPartAssignment).toEqual(jasmine.objectContaining({
			status: 'canonical',
			path: jasmine.stringMatching(/asset-pipeline\/wiki\/pipeline\.json$/),
		}));
		expect(artifact.diagnostics).not.toEqual(jasmine.arrayContaining([jasmine.objectContaining({
			code: 'missing-optional-part-assignment',
		})]));
	});

	it('adds generated optional parts as temporary alignment candidates without durable source components', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(normalizedFace(faceKey, [
				component('art-source', box(25, 45, 85, 125)),
			])),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(absentOptionalAssignment(faceKey, ['label', 'glyph'])),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifact = alignmentStage(fs, output3dDir, 'wiki', faceKey);
		const labelGroup = artifact.alignmentGroups.find((group) => group.groupId === 'label');
		const labelCandidate = artifact.candidates.find((candidate) => candidate.alignmentGroupId === labelGroup.alignmentGroupId);
		const labelMapping = artifact.sourcePartMappings.find((mapping) => mapping.sourcePartId === 'label');

		expect(labelGroup).toEqual(jasmine.objectContaining({
			matchStatus: 'skipped',
			strategy: 'temporary-generated',
			temporary: true,
			temporaryComponentPolicy: 'discard-before-final-rendering',
			sourceComponentIds: [],
			alignmentIds: [labelCandidate.alignmentId],
		}));
		expect(labelCandidate).toEqual(jasmine.objectContaining({
			candidateType: 'temporary-generated',
			matchStatus: 'skipped',
			strategy: 'temporary-generated',
			temporary: true,
			temporaryComponentPolicy: 'discard-before-final-rendering',
			sourceComponentIds: [],
			referencePartCandidates: ['label'],
			targetBounds: jasmine.objectContaining({
				left: 5,
				top: 5,
				right: 12,
				bottom: 18,
				width: 7,
				height: 13,
			}),
			alignedBounds: jasmine.objectContaining({
				left: 5,
				top: 5,
				right: 12,
				bottom: 18,
				width: 7,
				height: 13,
			}),
		}));
		expect(labelMapping).toEqual(jasmine.objectContaining({
			sourcePartId: 'label',
			alignmentCandidateId: labelCandidate.alignmentId,
			sourceComponentIds: [],
			matchStatus: 'skipped',
			strategy: 'temporary-generated',
			temporary: true,
			temporaryComponentPolicy: 'discard-before-final-rendering',
			targetBounds: jasmine.objectContaining({
				left: 5,
				top: 5,
				right: 12,
				bottom: 18,
				width: 7,
				height: 13,
			}),
			alignedBounds: jasmine.objectContaining({
				left: 5,
				top: 5,
				right: 12,
				bottom: 18,
				width: 7,
				height: 13,
			}),
		}));
	});

	it('does not infer accepted-absent optional parts from geometry after the optional gate', function() {
		const faceKey = 'flower-2';
		const structure = referenceStructure(faceKey);
		const optionalAcceptedOn = '2026-05-03T10:00:00.000Z';
		const artifact = alignFace({
			tilesetId: 'classic',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure: structure,
			referenceFace: structure.faces[faceKey],
			referenceStructurePath: 'reference-structure.json',
			normalizedFace: normalizedFace(faceKey, [
				component('looks-like-label', box(5, 5, 12, 18)),
				component('art-source', box(30, 40, 70, 110)),
			]),
			normalizedPath: 'normalized-components/flower-2.json',
			optionalAssignment: {
				...absentOptionalAssignment(faceKey, ['label', 'glyph']),
				status: 'accepted',
				optionalParts: {
					label: {
						partId: 'label',
						expected: false,
						sourceState: 'source-absent',
						suggestedComponentIds: [],
						reviewStatus: 'accepted',
						acceptedOn: optionalAcceptedOn,
					},
					glyph: {
						partId: 'glyph',
						expected: false,
						sourceState: 'source-absent',
						suggestedComponentIds: [],
						reviewStatus: 'accepted',
						acceptedOn: optionalAcceptedOn,
					},
				},
			},
			optionalAssignmentPath: 'tileset.json',
			semanticMap: {
				status: 'accepted',
				reviewStatus: 'accepted',
				bindings: {
					'looks-like-label': {
						partId: 'label',
						strength: 'accepted',
						reviewStatus: 'accepted',
						acceptedOn: '2026-05-03T11:00:00.000Z',
					},
				},
				parts: {
					label: {
						state: 'unbound',
						strength: 'none',
						reviewStatus: 'accepted',
					},
				},
			},
			semanticMapPath: 'tileset.json',
			faceMetadata: {},
		});
		const labelGroup = artifact.alignmentGroups.find((group) => group.groupId === 'label');
		const labelMapping = artifact.sourcePartMappings.find((mapping) => mapping.sourcePartId === 'label');

		expect(labelGroup).toEqual(jasmine.objectContaining({
			matchStatus: 'skipped',
			sourceComponentIds: [],
			strategy: 'temporary-generated',
		}));
		expect(labelMapping).toEqual(jasmine.objectContaining({
			sourceComponentIds: [],
			matchStatus: 'skipped',
			strategy: 'temporary-generated',
		}));
		expect(artifact.sourcePartMappings.some((mapping) => (
			(mapping.sourceComponentIds || []).includes('looks-like-label')
			&& (mapping.referencePartIds || []).includes('label')
		))).toBe(false);
	});

	it('lets repeated artwork exceed one target axis while keeping sibling breathing room', function() {
		const faceKey = 'b-2';
		const referenceStructure = repeatedBambooReferenceStructure(faceKey, {
			firstTarget: box(10, 10, 30, 40),
			secondTarget: box(60, 10, 80, 40),
		});
		const artifact = alignFace({
			tilesetId: 'wiki',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure,
			referenceFace: referenceStructure.faces[faceKey],
			referenceStructurePath: 'reference-structure.json',
			normalizedFace: normalizedFace(faceKey, [
				component('source-1', box(0, 0, 10, 20)),
				component('source-2', box(50, 0, 60, 20)),
			]),
			normalizedPath: 'normalized-components/b-2.json',
			faceMetadata: {},
		});
		const candidate = artifact.candidates.find((item) => item.referencePartCandidates.includes('bamboo.1'));
		const sibling = artifact.candidates.find((item) => item.referencePartCandidates.includes('bamboo.2'));

		expect(candidate.transform.fitPolicy).toBe('bounded-pixel-fit-shared-scale');
		expect(candidate.transform.scale.x).toBe(sibling.transform.scale.x);
		expect(candidate.transform.scale.x).toBeGreaterThan(1.5);
		expect(candidate.transform.scale.x).toBeLessThanOrEqual(2);
		expect(candidate.alignedBounds.width).toBeLessThanOrEqual(candidate.targetBounds.width + 0.000001);
		expect(candidate.alignedBounds.height).toBeGreaterThan(candidate.targetBounds.height);
	});

	it('rejects repeated artwork scale candidates that remove neighbor breathing room', function() {
		const faceKey = 'b-2';
		const referenceStructure = repeatedBambooReferenceStructure(faceKey, {
			firstTarget: box(10, 10, 30, 40),
			secondTarget: box(32, 10, 52, 40),
		});
		const artifact = alignFace({
			tilesetId: 'wiki',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure,
			referenceFace: referenceStructure.faces[faceKey],
			referenceStructurePath: 'reference-structure.json',
			normalizedFace: normalizedFace(faceKey, [
				component('source-1', box(0, 0, 20, 20)),
				component('source-2', box(50, 0, 70, 20)),
			]),
			normalizedPath: 'normalized-components/b-2.json',
			faceMetadata: {},
		});
		const candidate = artifact.candidates.find((item) => item.referencePartCandidates.includes('bamboo.1'));
		const sibling = artifact.candidates.find((item) => item.referencePartCandidates.includes('bamboo.2'));

		expect(candidate.transform.fitPolicy).toBe('bounded-pixel-fit-shared-scale');
		expect(candidate.transform.scale.x).toBe(1);
		expect(candidate.transform.scale.x).toBe(sibling.transform.scale.x);
		expect(sibling.alignedBounds.left - candidate.alignedBounds.right).toBeGreaterThanOrEqual(1);
	});

	it('keeps contain fit for repeated artwork with a large aspect mismatch', function() {
		const faceKey = 'b-6';
		const referenceStructure = repeatedBambooReferenceStructure(faceKey, {
			firstTarget: box(10, 10, 30, 62),
			secondTarget: box(60, 10, 80, 62),
		});
		const artifact = alignFace({
			tilesetId: 'wiki',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure,
			referenceFace: referenceStructure.faces[faceKey],
			referenceStructurePath: 'reference-structure.json',
			normalizedFace: normalizedFace(faceKey, [
				component('source-1', box(0, 0, 24, 20)),
				component('source-2', box(50, 0, 74, 20)),
			]),
			normalizedPath: 'normalized-components/b-6.json',
			faceMetadata: {},
		});
		const candidate = artifact.candidates.find((item) => item.referencePartCandidates.includes('bamboo.1'));

		expect(candidate.transform.fitPolicy).toBe('contain-fit-shared-scale');
		expect(candidate.alignedBounds.width).toBeLessThanOrEqual(candidate.targetBounds.width + 0.000001);
		expect(candidate.alignedBounds.height).toBeLessThanOrEqual(candidate.targetBounds.height + 0.000001);
	});

	it('equalizes repeated artwork to one shared group scale', function() {
		const faceKey = 'b-9';
		const referenceStructure = repeatedBambooReferenceStructure(faceKey, {
			firstTarget: box(10, 10, 30, 42),
			secondTarget: box(60, 10, 82, 42),
		});
		const artifact = alignFace({
			tilesetId: 'wiki',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure,
			referenceFace: referenceStructure.faces[faceKey],
			referenceStructurePath: 'reference-structure.json',
			normalizedFace: normalizedFace(faceKey, [
				component('source-1', box(0, 0, 10, 20)),
				component('source-2', box(50, 0, 60, 20)),
			]),
			normalizedPath: 'normalized-components/b-9.json',
			faceMetadata: {},
		});
		const scales = artifact.candidates
			.filter((candidate) => candidate.referencePartCandidates.some((partId) => partId.startsWith('bamboo.')))
			.map((candidate) => candidate.transform.scale.x);

		expect(new Set(scales).size).toBe(1);
		expect(scales[0]).toBeGreaterThan(1.5);
	});

	it('uses one shared contain-fit scale when repeated artwork has mixed fit eligibility', function() {
		const faceKey = 'b-5';
		const referenceStructure = repeatedBambooReferenceStructure(faceKey, {
			firstTarget: box(10, 10, 30, 72),
			secondTarget: box(60, 10, 84, 42),
		});
		const artifact = alignFace({
			tilesetId: 'wiki',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure,
			referenceFace: referenceStructure.faces[faceKey],
			referenceStructurePath: 'reference-structure.json',
			normalizedFace: normalizedFace(faceKey, [
				component('source-1', box(0, 0, 16, 30)),
				component('source-2', box(50, 0, 66, 30)),
			]),
			normalizedPath: 'normalized-components/b-5.json',
			faceMetadata: {},
		});
		const bambooCandidates = artifact.candidates
			.filter((candidate) => candidate.referencePartCandidates.some((partId) => partId.startsWith('bamboo.')));
		const scales = bambooCandidates.map((candidate) => candidate.transform.scale.x);

		expect(bambooCandidates.every((candidate) => candidate.transform.fitPolicy === 'contain-fit-shared-scale')).toBeTrue();
		expect(new Set(scales).size).toBe(1);
		expect(scales[0]).toBeLessThan(1.5);
	});

	it('does not let generated optional labels reserve artwork components', function() {
		const faceKey = 'b-2';
		const referenceStructure = repeatedBambooReferenceStructure(faceKey, {
			firstTarget: box(10, 10, 30, 40),
			secondTarget: box(60, 10, 80, 40),
		});
		const artifact = alignFace({
			tilesetId: 'wiki',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure,
			referenceFace: referenceStructure.faces[faceKey],
			referenceStructurePath: 'reference-structure.json',
			normalizedFace: normalizedFace(faceKey, [
				component('source-1', box(0, 0, 10, 20)),
				component('source-2', box(50, 0, 60, 20)),
			]),
			normalizedPath: 'normalized-components/b-2.json',
			optionalAssignment: optionalAssignment(faceKey, {
				label: ['source-1'],
			}, {
				outputOptions: {
					parts: {
						label: {
							partId: 'label',
							source: 'generated',
							renderMode: 'generated',
							outputPresent: true,
						},
					},
				},
			}),
			faceMetadata: {},
		});
		const bambooGroup = artifact.alignmentGroups.find((group) => group.groupId === 'bamboo');

		expect(bambooGroup.sourceComponentIds).toContain('source-1');
		expect(artifact.candidates.some((candidate) => candidate.sourceComponentIds.includes('source-1'))).toBeTrue();
	});

	it('uses fresh optional reservations instead of inferred generated semantic parts', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(defaultNormalizedFace(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(optionalAssignment(faceKey, {
				label: ['label-source'],
				glyph: ['glyph-source'],
			})),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'semantic-map')]: JSON.stringify(generatedSemanticMap(faceKey, 'label')),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifact = alignmentStage(fs, output3dDir, 'wiki', faceKey);
		const labelGroup = artifact.alignmentGroups.find((group) => group.groupId === 'label');
		const labelCandidate = artifact.candidates.find((candidate) => candidate.alignmentGroupId === labelGroup.alignmentGroupId);
		const artworkSourceIds = artifact.alignmentGroups
			.filter((group) => group.groupId !== 'label')
			.flatMap((group) => group.sourceComponentIds);

		expect(labelGroup.sourceComponentIds).toEqual(['label-source']);
		expect(artworkSourceIds).not.toContain('label-source');
		expect(labelGroup).toEqual(jasmine.objectContaining({
			matchStatus: 'matched',
			strategy: 'gap',
			sourceComponentIds: ['label-source'],
			alignmentIds: [labelCandidate.alignmentId],
		}));
		expect(labelCandidate).toEqual(jasmine.objectContaining({
			matchStatus: 'matched',
			sourceComponentIds: ['label-source'],
			referenceComponentIds: ['ref-label'],
		}));
	});

	it('carries reviewed optional label and glyph strength into alignment mappings', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const faceKey = 'flower-1';
		const optional = optionalAssignment(faceKey, {
			label: ['label-source'],
			glyph: ['glyph-source'],
		});
		for (const partId of ['label', 'glyph']) {
			optional.optionalParts[partId].strength = 'strong';
			optional.optionalParts[partId].reviewStatus = 'reviewed';
		}
		for (const reservation of optional.componentReservations) {
			reservation.strength = 'strong';
			reservation.reviewStatus = 'reviewed';
		}
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(defaultNormalizedFace(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(optional),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifact = alignmentStage(fs, output3dDir, 'wiki', faceKey);
		const labelMapping = artifact.sourcePartMappings.find((mapping) => mapping.sourcePartId === 'label');
		const glyphMapping = artifact.sourcePartMappings.find((mapping) => mapping.sourcePartId === 'glyph');

		expect(labelMapping).toEqual(jasmine.objectContaining({
			sourceComponentIds: ['label-source'],
			strength: 'strong',
			reviewStatus: 'inferred',
		}));
		expect(glyphMapping).toEqual(jasmine.objectContaining({
			sourceComponentIds: ['glyph-source'],
			strength: 'strong',
			reviewStatus: 'inferred',
		}));
	});

	it('allows accepted source absences to bind again when alignment finds character-number source components', function() {
		const faceKey = 'c-1';
		const reference = {
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
					parts: {
						glyph: referencePart('character-number-glyph', 'glyph', ['ref-glyph'], box(10, 5, 40, 25)),
					},
					components: [
						referenceComponent('ref-glyph', box(10, 5, 40, 25), { partIds: ['glyph'] }),
					],
				},
			},
		};

		const artifact = alignFace({
			tilesetId: 'traditional',
			faceKey,
			generatedOn: '2026-05-03T12:00:00.000Z',
			referenceStructure: reference,
			referenceFace: reference.faces[faceKey],
			referenceStructurePath: 'reference-structure.json',
			normalizedFace: normalizedFace(faceKey, [
				component('glyph-source', box(12, 126, 38, 134)),
				component('body-source', box(10, 150, 44, 190)),
			]),
			normalizedPath: 'normalized-components/c-1.json',
			optionalAssignment: optionalAssignment(faceKey, {}),
			optionalAssignmentPath: 'tileset.json',
			semanticMap: {
				status: 'accepted',
				reviewStatus: 'accepted',
				bindings: {},
				parts: {
					glyph: {
						state: 'unbound',
						strength: 'none',
						reviewStatus: 'accepted',
					},
				},
				assignments: [],
			},
			semanticMapPath: 'tileset.json',
			faceMetadata: {},
		});
		const glyphGroup = artifact.alignmentGroups.find((group) => group.groupId === 'glyph');
		const glyphCandidate = artifact.candidates.find((candidate) => candidate.alignmentGroupId === glyphGroup.alignmentGroupId);

		expect(glyphGroup).toEqual(jasmine.objectContaining({
			matchStatus: 'matched',
			sourceComponentIds: ['glyph-source'],
		}));
		expect(glyphCandidate).toEqual(jasmine.objectContaining({
			matchStatus: 'matched',
			sourceComponentIds: ['glyph-source'],
			referenceComponentIds: ['ref-glyph'],
		}));
	});

	it('ignores stale optional reservations that reference non-alignment component ids', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(defaultNormalizedFace(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(optionalAssignment(faceKey, {
				label: ['missing-label-source'],
				glyph: ['missing-glyph-source'],
			})),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifact = alignmentStage(fs, output3dDir, 'wiki', faceKey);
		const usedSourceIds = artifact.alignmentGroups.flatMap((group) => group.sourceComponentIds);

		expect(usedSourceIds).not.toContain('missing-label-source');
		expect(usedSourceIds).not.toContain('missing-glyph-source');
		expect(artifact.alignmentGroups.find((group) => group.groupId === 'label').sourceComponentIds).toEqual([]);
		expect(artifact.alignmentGroups.find((group) => group.groupId === 'glyph').sourceComponentIds).toEqual([]);
	});

	it('writes needs-review when a reference group has no bound reference components', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const faceKey = 'flower-1';
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructureWithUnboundArtwork(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify(defaultNormalizedFace(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(optionalAssignment(faceKey, {
				label: ['label-source'],
				glyph: ['glyph-source'],
			})),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const artifact = alignmentStage(fs, output3dDir, 'wiki', faceKey);

		expect(artifact.status).toBe('needs-review');
		expect(artifact.diagnostics).toEqual(jasmine.arrayContaining([jasmine.objectContaining({
			code: 'empty-reference-group',
			alignmentGroupId: 'align-group.flower-1.mainArtwork',
		})]));
		expect(stateUpdates[0].stages.alignment.status).toBe('needs-review');
	});

	it('keeps missing-input warnings separate from per-face alignment diagnostics', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const faceKey = 'flower-1';
		const normalized = defaultNormalizedFace(faceKey);
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(faceKey)),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'normalized-components')]: JSON.stringify({
				...normalized,
				alignmentComponentIds: [],
			}),
			[alignmentInputPath(output3dDir, 'wiki', faceKey, 'optional-parts')]: JSON.stringify(optionalAssignment(faceKey, {
				label: ['label-source'],
				glyph: ['glyph-source'],
			})),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		const summary = await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			faceKey,
			referenceStructurePath: referencePath,
		});
		const reportPath = path.resolve(BASE_OUTPUT, 'wiki', 'reports', 'source-alignment-report.flower-1.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary.warningCount).toBe(0);
		expect(report.warnings).toEqual([]);
		expect(report.faces[faceKey].status).toBe('needs-review');
		expect(report.faces[faceKey].diagnostics.length).toBeGreaterThan(0);
	});

	it('reports mixed full-run face statuses and totals', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const stateUpdates = [];
		const needsReviewFace = defaultNormalizedFace('flower-2');
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(['flower-1', 'flower-2', 'flower-3'])),
			...alignmentInputs(output3dDir, 'wiki', 'flower-1'),
			[alignmentInputPath(output3dDir, 'wiki', 'flower-2', 'normalized-components')]: JSON.stringify({
				...needsReviewFace,
				alignmentComponentIds: [],
			}),
			[alignmentInputPath(output3dDir, 'wiki', 'flower-2', 'optional-parts')]: JSON.stringify(optionalAssignment('flower-2', {
				label: ['label-source'],
				glyph: ['glyph-source'],
			})),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates });

		const summary = await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			referenceStructurePath: referencePath,
		});
		const reportPath = path.resolve(BASE_OUTPUT, 'wiki', 'reports', 'source-alignment-report.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual(jasmine.objectContaining({
			faceCount: 3,
			alignmentGroupCount: 6,
			candidateCount: 5,
			warningCount: 1,
		}));
		expect(report.faces['flower-1'].status).toBe('inferred');
		expect(report.faces['flower-2'].status).toBe('needs-review');
		expect(report.faces['flower-3']).toBeUndefined();
		expect(report.warnings).toEqual([jasmine.objectContaining({
			code: 'missing-normalized-components',
			faceKey: 'flower-3',
		})]);
		expect(stateUpdates.map((update) => update.faceKey)).toEqual(['flower-1', 'flower-2', 'flower-3']);
	});

	it('records optional-part assignment input only when the artifact exists', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
		const referencePath = path.resolve(rootDir, 'reference-structure.json');
		const fs = fakeFileSystem({
			[referencePath]: JSON.stringify(referenceStructure(['flower-1', 'flower-2'])),
			...alignmentInputs(output3dDir, 'wiki', 'flower-1'),
			[alignmentInputPath(output3dDir, 'wiki', 'flower-2', 'normalized-components')]: JSON.stringify(defaultNormalizedFace('flower-2')),
		});
		const runner = makeRunner({ fs, rootDir, output3dDir, stateUpdates: [] });

		await runSourceAlignment(runner, fs, output3dDir, {
			tilesetId: 'wiki',
			referenceStructurePath: referencePath,
		});
		const withOptional = alignmentStage(fs, output3dDir, 'wiki', 'flower-1');
		const withoutOptional = alignmentStage(fs, output3dDir, 'wiki', 'flower-2');

		expect(withOptional.inputs.optionalPartAssignment).toEqual(jasmine.objectContaining({
			status: 'canonical',
			generatedOn: '2026-05-03T12:00:00.000Z',
			path: jasmine.stringMatching(/asset-pipeline\/wiki\/pipeline\.json$/),
		}));
		expect(withoutOptional.inputs.optionalPartAssignment).toEqual(jasmine.objectContaining({
			status: 'canonical',
		}));
	});
});

function makeRunner({ fs, rootDir, output3dDir, stateUpdates }) {
	return new SourceAlignmentRunner({
		fileSystem: fs,
		rootDir,
		output3dDir,
		loadMetadata: () => ({}),
		updateState: (update) => stateUpdates.push(update),
		clock: () => '2026-05-03T12:00:00.000Z',
	});
}

function fakeFileSystem(initialFiles = {}) {
	const files = new Map(Object.entries(withCanonicalPipelineStates(initialFiles)));
	const writes = [];
	const fileFor = (filePath) => files.get(filePath)
		?? files.get(String(filePath).replaceAll('/', '\\'))
		?? files.get(String(filePath).replaceAll('\\', '/'));

	return {
		files,
		writes,
		async access(filePath) {
			if (fileFor(filePath) === undefined) {
				throw new Error(`Missing fake file: ${filePath}`);
			}
		},
		async readFile(filePath) {
			const content = fileFor(filePath);
			if (content === undefined) {
				throw new Error(`Missing fake file: ${filePath}`);
			}

			return content;
		},
		async writeFile(filePath, content, encoding) {
			writes.push({ filePath, encoding });
			files.set(filePath, content);
		},
		async mkdir() {},
	};
}

function withCanonicalPipelineStates(initialFiles) {
	const files = { ...initialFiles };
	const referenceFaceKeys = referenceFaceKeysFromFiles(files);
	const scopes = pipelineScopesFromFiles(files, referenceFaceKeys);

	for (const scope of scopes) {
		if (files[scope.pipelineStatePath]) {
			continue;
		}
		files[scope.pipelineStatePath] = JSON.stringify({
			schemaVersion: 1,
			tilesetId: scope.tilesetId,
			configuration: testOptionalConfiguration(),
			rendering: {
				defaults: {
					suits: {},
					faces: {},
				},
				overrides: {
					suits: {},
					faces: {},
				},
			},
			faces: Object.fromEntries(scope.faceKeys.map((faceKey) => {
				const optionalPath = scope.optionalPathFor(faceKey);
				const optional = files[optionalPath] ? JSON.parse(files[optionalPath]) : null;

				return [faceKey, {
					state: {
						components: {},
						shapes: {},
						parts: optionalPartsFromArtifact(optional),
						bindings: optionalBindingsFromArtifact(optional),
					},
					stages: {
						...(optional
							? { optionalPartAssignment: { status: optional.status || 'ready' } }
							: {}),
					},
					artifacts: {
						normalizedComponents: relativeTestPath(scope.normalizedPathFor(faceKey)),
						...(optional
							? { optionalPartAssignment: relativeTestPath(optionalPath) }
							: {}),
					},
				}];
			})),
			artifacts: {},
		});
	}

	return files;
}

function optionalPartsFromArtifact(optional) {
	return Object.fromEntries(Object.entries(optional?.optionalParts || {}).map(([partId, part]) => [partId, {
		partId,
		contentKind: part.contentKind || (partId === 'label' ? 'label' : 'glyph'),
		role: part.role || (partId === 'label' ? 'flower-label' : 'flower-character'),
		optional: true,
		reviewStatus: part.reviewStatus
			|| optional?.componentReservations?.find((reservation) => reservation.partId === partId)?.reviewStatus
			|| null,
	}]));
}

function optionalBindingsFromArtifact(optional) {
	return Object.fromEntries((optional?.componentReservations || [])
		.flatMap((reservation) => (reservation.componentIds || []).map((componentId) => [componentId, {
			componentId,
			partId: reservation.partId,
			strength: reservation.strength || 'tentative',
			reviewStatus: reservation.reviewStatus || 'inferred',
		}])));
}

function semanticMapFromOptionalParts(parts) {
	return {
		schemaVersion: 1,
		status: 'draft',
		reviewStatus: 'draft',
		bindings: Object.fromEntries(Object.entries(parts)
			.flatMap(([partId, componentIds]) => (componentIds || []).map((componentId) => [componentId, {
				componentId,
				partId,
				strength: 'tentative',
				reviewStatus: 'inferred',
			}]))),
		parts: {},
		assignments: [],
		diagnostics: [],
	};
}

function alignmentStage(fs, output3dDir, tilesetId, faceKey) {
	return JSON.parse(fs.files.get(alignmentInputPath(output3dDir, tilesetId, faceKey, 'alignment-map')));
}

async function runSourceAlignment(runner, fs, output3dDir, options) {
	const tilesetId = options.tilesetId || 'wiki';
	const statePath = path.resolve(BASE_OUTPUT, tilesetId, 'pipeline.json');
	if (!fs.files.has(statePath)) {
		const faceKeys = [...fs.files.keys()]
			.map((filePath) => filePath.match(/[\\/]asset-pipeline[\\/]([^\\/]+)[\\/]json[\\/]normalized-components[\\/]([^\\/]+)\.json$/))
			.filter((match) => match && match[1] === tilesetId)
			.map((match) => match[2])
			.sort((left, right) => left.localeCompare(right));
		fs.files.set(statePath, JSON.stringify({
			schemaVersion: 3,
			tilesetId,
			configuration: testOptionalConfiguration(),
			svgPipeline: {
				faces: Object.fromEntries(faceKeys.map((faceKey) => [faceKey, {
					artifacts: {
						normalizedComponents: alignmentInputPath(output3dDir, tilesetId, faceKey, 'normalized-components'),
					},
					state: { parts: {}, bindings: {} },
				}])),
			},
		}));
	}
	const reference = options.referenceStructurePath && fs.files.has(options.referenceStructurePath)
		? JSON.parse(fs.files.get(options.referenceStructurePath))
		: null;
	return runner.run({
		...options,
		pipelineModel: testPipelineModelFromFile({
			fileSystem: fs,
			statePath,
			reference,
			referenceFile: options.referenceStructurePath,
		}),
	});
}

function referenceFaceKeysFromFiles(files) {
	const faceKeys = new Set();

	for (const [filePath, content] of Object.entries(files)) {
		if (!filePath.endsWith('reference-structure.json')) {
			continue;
		}
		try {
			const reference = JSON.parse(content);
			Object.keys(reference.faces || {}).forEach((faceKey) => faceKeys.add(faceKey));
		} catch {
			// Ignore non-reference JSON in the fake filesystem.
		}
	}

	return [...faceKeys].sort((left, right) => left.localeCompare(right));
}

function pipelineScopesFromFiles(files, referenceFaceKeys) {
	const scopes = new Map();

	for (const filePath of Object.keys(files)) {
		const match = filePath.match(/^(.*[\/]scripts[\/]output[\/]asset-pipeline)[\/]([^\/]+)[\/]json[\/](normalized-components|optional-parts|semantic-map)[\/]([^\/]+)\.json$/);
		if (!match) {
			continue;
		}
		const [, output3dDir, tilesetId,, faceKey] = match;
		const key = `${output3dDir}::${tilesetId}`;
		const current = scopes.get(key) || {
			output3dDir,
			tilesetId,
			faceKeys: new Set(),
			pipelineStatePath: path.resolve(BASE_OUTPUT, tilesetId, 'pipeline.json'),
			normalizedPathFor: (nextFaceKey) => alignmentInputPath(output3dDir, tilesetId, nextFaceKey, 'normalized-components'),
			optionalPathFor: (nextFaceKey) => alignmentInputPath(output3dDir, tilesetId, nextFaceKey, 'optional-parts'),
		};
		current.faceKeys.add(faceKey);
		scopes.set(key, current);
	}

	if (scopes.size === 0) {
		const referencePath = Object.keys(files).find((filePath) => filePath.endsWith('reference-structure.json'));
		if (referencePath) {
			const rootDir = path.dirname(referencePath);
			const output3dDir = path.resolve(rootDir, 'scripts/output/3d-assets');
			scopes.set(`${output3dDir}::wiki`, {
				output3dDir,
				tilesetId: 'wiki',
				faceKeys: new Set(referenceFaceKeys),
			pipelineStatePath: path.resolve(BASE_OUTPUT, 'wiki', 'pipeline.json'),
				normalizedPathFor: (nextFaceKey) => alignmentInputPath(output3dDir, 'wiki', nextFaceKey, 'normalized-components'),
				optionalPathFor: (nextFaceKey) => alignmentInputPath(output3dDir, 'wiki', nextFaceKey, 'optional-parts'),
			});
		}
	}

	return [...scopes.values()].map((scope) => ({
		...scope,
		faceKeys: [...new Set([...referenceFaceKeys, ...scope.faceKeys])].sort((left, right) => left.localeCompare(right)),
	}));
}

function relativeTestPath(filePath) {
	const testRootIndex = filePath.replaceAll('\\', '/').indexOf('test-root/');

	return testRootIndex >= 0
		? filePath.replaceAll('\\', '/').slice(testRootIndex + 'test-root/'.length)
		: filePath.replaceAll('\\', '/');
}

function referenceStructure(faceKeys) {
	const keys = Array.isArray(faceKeys) ? faceKeys : [faceKeys];

	return {
		referenceSet: {
			referenceSetId: 'test-reference',
			coordinateSpace: {
				preparedViewBox: [0, 0, 94, 136],
			},
		},
		faces: Object.fromEntries(keys.map((faceKey) => [faceKey, referenceFace()])),
	};
}

function referenceFace() {
	return {
		image: {
			width: 100,
			height: 140,
		},
		parts: {
			label: referencePart('flower-label', 'label', ['ref-label'], box(5, 5, 12, 18)),
			glyph: referencePart('flower-character', 'glyph', ['ref-glyph'], box(76, 5, 92, 28)),
			mainArtwork: referencePart('main-artwork', 'artwork', ['ref-art'], box(30, 40, 70, 110)),
		},
		components: [
			referenceComponent('ref-label', box(5, 5, 12, 18), { partIds: ['label'] }),
			referenceComponent('ref-glyph', box(76, 5, 92, 28), { partIds: ['glyph'] }),
			referenceComponent('ref-art', box(30, 40, 70, 110), { partIds: ['mainArtwork'] }),
		],
	};
}

function referenceStructureWithGlyphOnly(faceKey) {
	return {
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
				parts: {
					glyph: referencePart('flower-character', 'glyph', ['ref-glyph'], box(76, 5, 92, 28)),
				},
				components: [
					referenceComponent('ref-glyph', box(76, 5, 92, 28), { partIds: ['glyph'] }),
				],
			},
		},
	};
}

function referenceStructureWithUnboundArtwork(faceKey) {
	const structure = referenceStructure(faceKey);
	structure.faces[faceKey].parts.mainArtwork = referencePart('main-artwork', 'artwork', [], box(30, 40, 70, 110));
	return structure;
}

function repeatedBambooReferenceStructure(faceKey, { firstTarget, secondTarget }) {
	return {
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
				parts: {
					'bamboo.1': referencePart('bamboo-stick', 'artwork', ['ref-bamboo-1'], firstTarget),
					'bamboo.2': referencePart('bamboo-stick', 'artwork', ['ref-bamboo-2'], secondTarget),
				},
				components: [
					referenceComponent('ref-bamboo-1', firstTarget, { partIds: ['bamboo.1'], semanticRoles: ['bamboo-stick'] }),
					referenceComponent('ref-bamboo-2', secondTarget, { partIds: ['bamboo.2'], semanticRoles: ['bamboo-stick'] }),
				],
			},
		},
	};
}

function absentOptionalAssignment(faceKey, partIds) {
	return {
		schemaVersion: 1,
		faceKey,
		status: 'canonical',
		generatedOn: '2026-05-03T12:00:00.000Z',
		optionalParts: Object.fromEntries(partIds.map((partId) => [partId, {
			partId,
			expected: false,
			sourceState: 'source-absent',
			suggestedComponentIds: [],
		}])),
		componentReservations: [],
	};
}

function alignmentInputs(output3dDir, tilesetId, faceKey) {
	return {
		[alignmentInputPath(output3dDir, tilesetId, faceKey, 'normalized-components')]: JSON.stringify(defaultNormalizedFace(faceKey)),
		[alignmentInputPath(output3dDir, tilesetId, faceKey, 'optional-parts')]: JSON.stringify(optionalAssignment(faceKey, {
			label: ['label-source'],
			glyph: ['glyph-source'],
		})),
	};
}

function defaultNormalizedFace(faceKey) {
	return normalizedFace(faceKey, [
		component('label-source', box(4, 4, 14, 20)),
		component('glyph-source', box(78, 4, 96, 28)),
		component('art-source', box(25, 45, 85, 125)),
	]);
}

function normalizedFace(faceKey, components) {
	return {
		sourceFile: `scripts/data/3d-assets/sprite-source-svgs/wiki/${faceKey}.svg`,
		alignmentBounds: box(0, 0, 100, 140),
		alignmentComponentIds: components.map((item) => item.componentId),
		components,
	};
}

function sourceShape(shapeId, componentIds, bounds) {
	return {
		shapeId,
		sourceOrder: 0,
		componentIds,
		componentCount: componentIds.length,
		sourceElementComponentId: componentIds[0],
		sourceElementComponentIds: componentIds,
		sourceElementIds: [],
		parentGroupIds: [],
		splitStrategies: [],
		cohesionReason: componentIds.length > 1 ? 'contained-layer' : 'single-component',
		splittable: false,
		classNames: [],
		fills: [],
		strokes: [],
		dominantColor: '#111111',
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		area: bounds.width * bounds.height,
		classification: {
			tileLayerCandidate: false,
			negativeSpaceCandidate: false,
		},
	};
}

function optionalAssignment(faceKey, parts, overrides = {}) {
	const optionalParts = {};
	const componentReservations = [];

	for (const [partId, componentIds] of Object.entries(parts)) {
		optionalParts[partId] = {
			partId,
			expected: true,
			sourceState: 'candidate-found',
			suggestedComponentIds: componentIds,
		};
		componentReservations.push({
			partId,
			componentIds,
			reviewStatus: 'inferred',
		});
	}

	return {
		schemaVersion: 1,
		faceKey,
		status: 'canonical',
		generatedOn: '2026-05-03T12:00:00.000Z',
		optionalParts,
		componentReservations,
		...overrides,
	};
}

function testOptionalConfiguration() {
	return {
		suits: {
			flowers: {
				parts: {
					label: { sourceSearch: { region: 'top-left' } },
					glyph: { sourceSearch: { region: 'top-right' } },
				},
			},
			characters: {
				parts: {
					label: { sourceSearch: { region: 'top-left' } },
				},
			},
		},
	};
}

function generatedSemanticMap(faceKey, partId, overrides = {}) {
	return {
		schemaVersion: 1,
		faceKey,
		status: 'canonical',
		generatedOn: '2026-05-03T12:00:00.000Z',
		assignments: [{
			assignmentId: `assign.${faceKey}.${partId}`,
			sourcePartId: partId,
			referencePartId: partId,
			sourceComponentIds: [],
			referenceComponentIds: [`ref-${partId}`],
			assignmentType: 'generated',
			strength: 'none',
			strategy: 'source-part-state',
			reviewStatus: 'inferred',
		}],
		bindings: {},
		parts: {
			[partId]: {
				state: 'generated',
				strength: 'none',
				source: 'source-part-state',
				reviewStatus: 'inferred',
			},
		},
		components: {},
		diagnostics: [],
		...overrides,
	};
}

function referencePart(role, contentKind, componentIds, targetBounds) {
	return {
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

function component(componentId, bounds) {
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
	};
}

function alignmentInputPath(output3dDir, tilesetId, faceKey, stageDir) {
	const stageSegments = {
		'normalized-components': ['json', 'normalized-components'],
		'optional-parts': ['json', 'optional-parts'],
		'semantic-map': ['json', 'semantic-map'],
		'alignment-map': ['json', 'source-alignment'],
	}[stageDir] || ['json', stageDir];
	return path.resolve(BASE_OUTPUT, tilesetId, ...stageSegments, `${faceKey}.json`);
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




