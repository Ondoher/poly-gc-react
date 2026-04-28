import path from 'path';
import { OptionalPartAssignmentRunner } from '../OptionalPartAssignmentRunner.js';

describe('OptionalPartAssignmentRunner', function() {
	it('writes optional-part artifacts, reports, and state for one face', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const normalizedPath = normalizedArtifactPath(output3dDir, 'wiki', 'flower-1');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: {
					'flower-1': canonicalFaceState('source/flower-1.svg', normalizedPath),
				},
			}),
			[normalizedPath]: JSON.stringify(normalizedArtifact('flower-1', [
				normalizedComponent('label-candidate', box(4, 4, 14, 20), { sourceIndex: 0, fill: '#d00' }),
				normalizedComponent('glyph-candidate', box(78, 4, 94, 24), { sourceIndex: 1, fill: '#111' }),
				normalizedComponent('body-art', box(20, 45, 80, 120), { sourceIndex: 2, fill: '#070' }),
			])),
		});
		const runner = new OptionalPartAssignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
		});

		const summary = await runner.run({
			tilesetId: 'wiki',
			pipelineStatePath: statePath,
			faceKey: 'flower-1',
		});

		const artifactPath = optionalArtifactPath(output3dDir, 'wiki', 'flower-1');
		const reportPath = path.resolve(output3dDir, 'svg-preprocessor', 'wiki', 'reports', 'optional-part-assignment-report.flower-1.json');
		const artifact = JSON.parse(fs.files.get(artifactPath));
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual({
			tilesetId: 'wiki',
			faceCount: 1,
			optionalPartCount: 2,
			candidateCount: artifact.summary.candidateCount,
			diagnosticCount: artifact.diagnostics.length,
			warningCount: artifact.diagnostics.filter((diagnostic) => diagnostic.level === 'warning').length,
			optionalPartsDir: normalizeForTest(rootDir, path.dirname(artifactPath)),
			reportPath: normalizeForTest(rootDir, reportPath),
		});
		expect(artifact.optionalParts.label.sourceState).toBe('candidate-found');
		expect(artifact.optionalParts.glyph.sourceState).toBe('candidate-found');
		expect(report.faces['flower-1']).toEqual(jasmine.objectContaining({
			status: artifact.status,
			optionalPartCount: 2,
			candidateCount: artifact.summary.candidateCount,
			bindingCount: 2,
		}));
		const state = JSON.parse(fs.files.get(statePath));
		expect(state.faces['flower-1'].stages.optionalPartAssignment).toEqual(jasmine.objectContaining({
			status: artifact.status,
			artifact: normalizeForTest(rootDir, artifactPath),
			optionalPartCount: 2,
			candidateCount: artifact.summary.candidateCount,
			bindingCount: 2,
			diagnosticCount: artifact.diagnostics.length,
		}));
		expect(Object.values(state.faces['flower-1'].state.bindings).length).toBe(2);
		expect(Object.values(state.faces['flower-1'].state.bindings)
			.map((binding) => binding.partId)
			.sort()).toEqual(['glyph', 'label']);
		expect(Object.values(state.faces['flower-1'].state.bindings)
			.every((binding) => binding.strength === 'accepted'
				&& binding.reviewStatus === 'accepted'
				&& binding.acceptedOn === '2026-05-03T12:00:00.000Z'
				&& binding.updatedOn === '2026-05-03T12:00:00.000Z')).toBe(true);
		expect(state.faces['flower-1'].state.parts.label).toEqual(jasmine.objectContaining({
			reviewStatus: 'accepted',
			acceptedOn: '2026-05-03T12:00:00.000Z',
			updatedOn: '2026-05-03T12:00:00.000Z',
		}));
		expect(state.faces['flower-1'].state.parts.glyph).toEqual(jasmine.objectContaining({
			reviewStatus: 'accepted',
			acceptedOn: '2026-05-03T12:00:00.000Z',
			updatedOn: '2026-05-03T12:00:00.000Z',
		}));
		expect(fs.writes.filter((write) => [artifactPath, reportPath].includes(write.filePath))
			.every((write) => write.encoding === 'utf8')).toBe(true);
	});

	it('limits processing to the requested face key', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const flower1NormalizedPath = normalizedArtifactPath(output3dDir, 'wiki', 'flower-1');
		const flower2NormalizedPath = normalizedArtifactPath(output3dDir, 'wiki', 'flower-2');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: {
					'flower-1': canonicalFaceState('source/flower-1.svg', flower1NormalizedPath),
					'flower-2': canonicalFaceState('source/flower-2.svg', flower2NormalizedPath),
				},
			}),
			[flower1NormalizedPath]: JSON.stringify(normalizedArtifact('flower-1', [
				normalizedComponent('label-candidate', box(4, 4, 14, 20)),
			])),
			[flower2NormalizedPath]: JSON.stringify(normalizedArtifact('flower-2', [
				normalizedComponent('label-candidate', box(4, 4, 14, 20)),
			])),
		});
		const runner = new OptionalPartAssignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
		});

		await runner.run({
			tilesetId: 'wiki',
			pipelineStatePath: statePath,
			faceKey: 'flower-2',
		});

		const reportPath = path.resolve(output3dDir, 'svg-preprocessor', 'wiki', 'reports', 'optional-part-assignment-report.flower-2.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(fs.files.has(optionalArtifactPath(output3dDir, 'wiki', 'flower-1'))).toBe(false);
		expect(fs.files.has(optionalArtifactPath(output3dDir, 'wiki', 'flower-2'))).toBe(true);
		expect(Object.keys(report.faces)).toEqual(['flower-2']);
	});

	it('resets canonical state to accepted optional bindings on rerun', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const normalizedPath = normalizedArtifactPath(output3dDir, 'wiki', 'flower-1');
		const faceState = canonicalFaceState('source/flower-1.svg', normalizedPath);
		faceState.state = {
			parts: {
				label: { partId: 'label', reviewStatus: 'accepted', acceptedOn: 'old' },
				mainArtwork: { partId: 'mainArtwork', reviewStatus: 'accepted', acceptedOn: 'old' },
			},
			bindings: {
				'old-label': { componentId: 'old-label', partId: 'label', strength: 'accepted' },
				'body-art': { componentId: 'body-art', partId: 'mainArtwork', strength: 'accepted' },
			},
		};
		faceState.stages = {
			alignment: { status: 'ready' },
			semanticAssignment: { status: 'ready' },
			sourceApproval: { status: 'accepted' },
			finalRendering: { status: 'ready' },
		};
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: {
					'flower-1': faceState,
				},
			}),
			[normalizedPath]: JSON.stringify(normalizedArtifact('flower-1', [
				normalizedComponent('label-candidate', box(4, 4, 14, 20), { sourceIndex: 0 }),
				normalizedComponent('glyph-candidate', box(78, 4, 94, 24), { sourceIndex: 1 }),
				normalizedComponent('body-art', box(20, 45, 80, 120), { sourceIndex: 2 }),
			])),
		});
		const runner = new OptionalPartAssignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
		});

		await runner.run({
			tilesetId: 'wiki',
			pipelineStatePath: statePath,
			faceKey: 'flower-1',
		});

		const state = JSON.parse(fs.files.get(statePath));
		expect(Object.keys(state.faces['flower-1'].state.bindings).sort()).toEqual(['glyph-candidate', 'label-candidate']);
		expect(state.faces['flower-1'].state.bindings['label-candidate'].strength).toBe('accepted');
		expect(state.faces['flower-1'].state.bindings['glyph-candidate'].strength).toBe('accepted');
		expect(state.faces['flower-1'].state.parts.label.reviewStatus).toBe('accepted');
		expect(state.faces['flower-1'].state.parts.glyph.reviewStatus).toBe('accepted');
		expect(state.faces['flower-1'].state.parts.mainArtwork.reviewStatus).toBeUndefined();
		expect(state.faces['flower-1'].stages.alignment).toBeUndefined();
		expect(state.faces['flower-1'].stages.semanticAssignment).toBeUndefined();
		expect(state.faces['flower-1'].stages.sourceApproval).toBeUndefined();
		expect(state.faces['flower-1'].stages.finalRendering).toBeUndefined();
	});

	it('reserves accepted label candidates before choosing glyph candidates', function() {
		const rootDir = path.resolve('test-root');
		const runner = new OptionalPartAssignmentRunner({ rootDir });
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'flower-1',
			bulkOptions: {
				families: {
					flower: {
						label: { region: 'either-corner' },
						character: { region: 'either-corner' },
					},
				},
			},
			alignmentBounds: box(0, 0, 140, 185),
			components: [
				normalizedComponent('label-candidate', box(78, 4, 94, 24), { sourceIndex: 0, fill: '#d00' }),
				normalizedComponent('glyph-candidate', box(4, 4, 70, 60), { sourceIndex: 1, fill: '#00d' }),
				normalizedComponent('body-art', box(20, 70, 80, 120), { sourceIndex: 2, fill: '#070' }),
			],
		}));

		expect(bindingSuggestionForPart(artifact, 'label')).toEqual(jasmine.objectContaining({
			componentIds: ['label-candidate'],
		}));
		expect(bindingSuggestionForPart(artifact, 'glyph')).toEqual(jasmine.objectContaining({
			componentIds: ['glyph-candidate'],
		}));
		expect(bindingSuggestionForPart(artifact, 'glyph').componentIds).not.toContain('label-candidate');
	});

	it('records missing normalized artifacts as report warnings', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: {
					'wind-n': canonicalFaceState('source/wind-n.svg', normalizedArtifactPath(output3dDir, 'wiki', 'wind-n')),
				},
			}),
		});
		const runner = new OptionalPartAssignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
		});

		const summary = await runner.run({ tilesetId: 'wiki', pipelineStatePath: statePath });
		const reportPath = path.resolve(output3dDir, 'svg-preprocessor', 'wiki', 'reports', 'optional-part-assignment-report.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary.faceCount).toBe(0);
		expect(summary.warningCount).toBe(1);
		expect(report.warnings).toEqual([{
			faceKey: 'wind-n',
			code: 'missing-normalized-components',
			message: `No normalized component artifact exists at ${normalizeForTest(rootDir, normalizedArtifactPath(output3dDir, 'wiki', 'wind-n'))}.`,
		}]);
		const state = JSON.parse(fs.files.get(statePath));
		expect(state.faces['wind-n'].stages.optionalPartAssignment.status).toBe('missing-normalized-components');
	});

	it('applies bulk searchSource false as source absent without candidates or reservations', async function() {
		const rootDir = path.resolve('test-root');
		const runner = new OptionalPartAssignmentRunner({ rootDir });
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'flower-1',
			bulkOptions: {
				families: {
					flower: {
						label: { searchSource: false },
					},
				},
			},
			components: [
				normalizedComponent('label-candidate', box(4, 4, 14, 20)),
				normalizedComponent('glyph-candidate', box(78, 4, 94, 24)),
			],
		}));

		expect(artifact.optionalParts.label.sourceState).toBe('source-absent');
		expect(artifact.optionalParts.label.candidates).toEqual([]);
		expect(artifact.optionalParts.label.suggestedComponentIds).toEqual([]);
		expect(artifact.metadataSeed.glyphLayout.label.sourceCorner).toBe('topRight');
		expect(artifact.bindingSuggestions.some((suggestion) => suggestion.partId === 'label')).toBe(false);
	});

	it('keeps optional metadata seed focused on source parsing hints', async function() {
		const rootDir = path.resolve('test-root');
		const runner = new OptionalPartAssignmentRunner({ rootDir });
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'flower-1',
			bulkOptions: {
				families: {
					flower: {
						character: { searchSource: true },
					},
				},
			},
			components: [
				normalizedComponent('glyph-candidate', box(4, 4, 20, 24)),
			],
		}));

		expect(artifact.metadataSeed.glyphLayout.character.outputPresent).toBeUndefined();
		expect(artifact.metadataSeed.glyphLayout.character.sourceCorner).toBe('topLeft');
	});

	it('creates optional source specs for label and glyph parts that exist in the reference suit', function() {
		const runner = new OptionalPartAssignmentRunner({ rootDir: path.resolve('test-root') });
		const characterArtifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'c-2',
			components: [],
			alignmentBounds: null,
		}));
		const windArtifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'wind-e',
			components: [],
			alignmentBounds: null,
		}));
		const seasonArtifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'season-1',
			components: [],
			alignmentBounds: null,
		}));
		const dragonArtifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'dragon-r',
			components: [],
			alignmentBounds: null,
		}));

		expect(characterArtifact.optionalParts.label).toEqual(jasmine.objectContaining({
			role: 'suit-label',
		}));
		expect(characterArtifact.optionalParts.glyph).toBeUndefined();
		expect(windArtifact.optionalParts.label).toEqual(jasmine.objectContaining({
			role: 'wind-label',
		}));
		expect(windArtifact.optionalParts.glyph).toBeUndefined();
		expect(seasonArtifact.optionalParts.label).toEqual(jasmine.objectContaining({
			role: 'suit-label',
		}));
		expect(seasonArtifact.optionalParts.glyph).toEqual(jasmine.objectContaining({
			role: 'season-character',
		}));
		expect(dragonArtifact.optionalParts.label).toEqual(jasmine.objectContaining({
			role: 'dragon-label',
		}));
	});

	it('uses pair layout bulk options to place label and character regions', async function() {
		const rootDir = path.resolve('test-root');
		const runner = new OptionalPartAssignmentRunner({ rootDir });
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'flower-1',
			bulkOptions: {
				families: {
					flower: {
						layout: 'label-left-character-right',
					},
				},
			},
			components: [
				normalizedComponent('left', box(4, 4, 14, 20)),
				normalizedComponent('right', box(80, 4, 94, 24)),
			],
		}));

		expect(artifact.optionalParts.label.hint.region).toBe('top-left');
		expect(artifact.optionalParts.glyph.hint.region).toBe('top-right');
	});

	it('builds candidates only from alignment components', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const tile = normalizedComponent('tile', box(4, 4, 14, 20), {
			classification: { tileLayerCandidate: true, negativeSpaceCandidate: false },
		});
		const cutout = normalizedComponent('cutout', box(80, 4, 94, 24), {
			classification: { tileLayerCandidate: false, negativeSpaceCandidate: true },
		});
		const alignment = normalizedComponent('alignment', box(5, 5, 16, 22));
		const normalizedPath = normalizedArtifactPath(output3dDir, 'wiki', 'b-1');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: { 'b-1': canonicalFaceState('source/b-1.svg', normalizedPath) },
			}),
			[normalizedPath]: JSON.stringify(normalizedArtifact('b-1', [tile, cutout, alignment], {
				alignmentComponentIds: ['tile', 'cutout', 'alignment'],
				alignmentBounds: box(0, 0, 100, 140),
			})),
		});
		const runner = new OptionalPartAssignmentRunner({ fileSystem: fs, rootDir, output3dDir });

		await runner.run({ tilesetId: 'wiki', pipelineStatePath: statePath });

		const artifact = JSON.parse(fs.files.get(optionalArtifactPath(output3dDir, 'wiki', 'b-1')));
		const candidateIds = artifact.optionalParts.label.candidates.flatMap((candidate) => candidate.componentIds);

		expect(candidateIds).toEqual(['alignment']);
	});

	it('records informational diagnostics when no strong optional candidate is found', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const normalizedPath = normalizedArtifactPath(output3dDir, 'wiki', 'b-1');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: { 'b-1': canonicalFaceState('source/b-1.svg', normalizedPath) },
			}),
			[normalizedPath]: JSON.stringify(normalizedArtifact('b-1', [
				normalizedComponent('body-art', box(25, 60, 90, 130)),
			])),
		});
		const runner = new OptionalPartAssignmentRunner({ fileSystem: fs, rootDir, output3dDir });

		await runner.run({ tilesetId: 'wiki', pipelineStatePath: statePath });

		const artifact = JSON.parse(fs.files.get(optionalArtifactPath(output3dDir, 'wiki', 'b-1')));

		expect(artifact.status).toBe('ready');
		expect(artifact.optionalParts.label.sourceState).toBe('needs-review');
		expect(artifact.diagnostics).toEqual([jasmine.objectContaining({
			level: 'info',
			code: 'no-optional-part-candidate',
			partId: 'label',
		})]);
	});

	it('keeps weak optional candidates out of suggested bindings and reservations', function() {
		const runner = new OptionalPartAssignmentRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-4',
			alignmentBounds: box(207, 205, 276, 294),
			components: [
				normalizedComponent('bamboo-stem', box(235.458, 210.254, 247.377, 226.61), {
					sourceIndex: 5,
					fill: '#c20000',
				}),
			],
		}));

		expect(artifact.optionalParts.label.sourceState).toBe('needs-review');
		expect(artifact.optionalParts.label.strength).toBe('none');
		expect(artifact.optionalParts.label.suggestedComponentIds).toEqual([]);
		expect(artifact.optionalParts.label.candidates[0].componentIds).toEqual(['bamboo-stem']);
		expect(artifact.bindingSuggestions).toEqual([]);
	});

	it('processes full manifest runs in sorted face-key order', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const windPath = normalizedArtifactPath(output3dDir, 'wiki', 'wind-n');
		const bPath = normalizedArtifactPath(output3dDir, 'wiki', 'b-1');
		const flowerPath = normalizedArtifactPath(output3dDir, 'wiki', 'flower-1');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: {
					'wind-n': canonicalFaceState('source/wind-n.svg', windPath),
					'b-1': canonicalFaceState('source/b-1.svg', bPath),
					'flower-1': canonicalFaceState('source/flower-1.svg', flowerPath),
				},
			}),
			[windPath]: JSON.stringify(normalizedArtifact('wind-n', [
				normalizedComponent('wind-label', box(4, 4, 14, 20)),
			])),
			[bPath]: JSON.stringify(normalizedArtifact('b-1', [
				normalizedComponent('b-label', box(4, 4, 14, 20)),
			])),
			[flowerPath]: JSON.stringify(normalizedArtifact('flower-1', [
				normalizedComponent('flower-label', box(4, 4, 14, 20)),
			])),
		});
		const runner = new OptionalPartAssignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
		});

		await runner.run({ tilesetId: 'wiki', pipelineStatePath: statePath });

		const reportPath = path.resolve(output3dDir, 'svg-preprocessor', 'wiki', 'reports', 'optional-part-assignment-report.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(Object.keys(report.faces)).toEqual(['b-1', 'flower-1', 'wind-n']);
		const state = JSON.parse(fs.files.get(statePath));
		expect(Object.keys(state.faces).sort()).toEqual(['b-1', 'flower-1', 'wind-n']);
	});

	it('uses full-run and single-face report filenames', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const normalizedPath = normalizedArtifactPath(output3dDir, 'wiki', 'b-1');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: { 'b-1': canonicalFaceState('source/b-1.svg', normalizedPath) },
			}),
			[normalizedPath]: JSON.stringify(normalizedArtifact('b-1', [
				normalizedComponent('label', box(4, 4, 14, 20)),
			])),
		});
		const runner = new OptionalPartAssignmentRunner({ fileSystem: fs, rootDir, output3dDir });

		await runner.run({ tilesetId: 'wiki', pipelineStatePath: statePath });
		await runner.run({ tilesetId: 'wiki', pipelineStatePath: statePath, faceKey: 'b-1' });

		expect(fs.files.has(path.resolve(output3dDir, 'svg-preprocessor', 'wiki', 'reports', 'optional-part-assignment-report.json')))
			.toBe(true);
		expect(fs.files.has(path.resolve(output3dDir, 'svg-preprocessor', 'wiki', 'reports', 'optional-part-assignment-report.b-1.json')))
			.toBe(true);
	});

	it('uses tileset id as the input and output scope', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'custom');
		const normalizedPath = normalizedArtifactPath(output3dDir, 'custom', 'b-1');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'custom',
				faces: { 'b-1': canonicalFaceState('source/b-1.svg', normalizedPath) },
			}),
			[normalizedPath]: JSON.stringify(normalizedArtifact('b-1', [
				normalizedComponent('label', box(4, 4, 14, 20)),
			])),
		});
		const runner = new OptionalPartAssignmentRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
		});

		const summary = await runner.run({ tilesetId: 'custom', pipelineStatePath: statePath });

		expect(summary.tilesetId).toBe('custom');
		expect(fs.files.has(optionalArtifactPath(output3dDir, 'custom', 'b-1'))).toBe(true);
		expect(summary.reportPath).toBe(normalizeForTest(
			rootDir,
			path.resolve(output3dDir, 'svg-preprocessor', 'custom', 'reports', 'optional-part-assignment-report.json'),
		));
	});

	it('applies short family bulk aliases', async function() {
		const runner = new OptionalPartAssignmentRunner({ rootDir: path.resolve('test-root') });
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-1',
			bulkOptions: {
				families: {
					b: {
						label: { searchSource: false },
					},
				},
			},
			components: [
				normalizedComponent('label', box(4, 4, 14, 20)),
			],
		}));

		expect(artifact.optionalParts.label.sourceState).toBe('source-absent');
		expect(artifact.metadataSeed.glyphLayout.label.outputPresent).toBeUndefined();
		expect(artifact.bindingSuggestions).toEqual([]);
	});

	it('uses score thresholds for excluded, needs-review, and candidate-found states', function() {
		const runner = new OptionalPartAssignmentRunner();
		const spec = runner.makeSourcePartSpec('label', 'label', 'suit-label', 'top-left', 'label');
		const excluded = runner.scoreCandidatesForSpec([
			candidateUnit('excluded', box(80, 120, 90, 130), { areaRatio: 0.01, normalizedCenter: { x: 0.85, y: 0.9 } }),
		], spec).filter((candidate) => candidate.score >= 0.35);
		const review = runner.scoreCandidatesForSpec([
			candidateUnit('review', box(20, 50, 30, 60), { areaRatio: 0.04, normalizedCenter: { x: 0.25, y: 0.4 } }),
		], spec).filter((candidate) => candidate.score >= 0.35);
		const found = runner.scoreCandidatesForSpec([
			candidateUnit('found', box(4, 4, 14, 20), { areaRatio: 0.04, normalizedCenter: { x: 0.08, y: 0.08 } }),
		], spec).filter((candidate) => candidate.score >= 0.35);

		expect(excluded).toEqual([]);
		expect(review.length).toBe(1);
		expect(review[0].score).toBeGreaterThanOrEqual(0.35);
		expect(review[0].score).toBeLessThan(0.55);
		expect(found.length).toBe(1);
		expect(found[0].score).toBeGreaterThanOrEqual(0.55);
	});

	it('lets expected-label OCR evidence outrank the default corner weighting', function() {
		const runner = new OptionalPartAssignmentRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'd-4',
			alignmentBounds: box(0, 0, 360, 450),
			components: [
				normalizedComponent('corner-dot', box(10, 10, 34, 34), { sourceIndex: 0, fill: '#333' }),
				normalizedComponent('label-four', box(237, 333, 245, 344), {
					sourceIndex: 3,
					fill: '#000',
					labelOcr: {
						source: 'label-ocr-template',
						sourceId: 'label-four',
						componentIds: ['label-four'],
						expectedLabel: '4',
						templateId: 'digit-4',
						pixelMeanAbsoluteError: 0.232,
						candidateDarkness: 0.2,
						templateDarkness: 0.18,
						threshold: 0.3,
						match: true,
					},
				}),
			],
		}));

		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['label-four']);
		expect(artifact.optionalParts.label.candidates[0]).toEqual(jasmine.objectContaining({
			componentIds: ['label-four'],
			labelOcrMatch: true,
		}));
		expect(artifact.optionalParts.label.candidates[0].reasons).toContain('label-ocr-match');
	});

	it('dedupes candidate units with the same component id set', function() {
		const runner = new OptionalPartAssignmentRunner();
		const units = runner.dedupeCandidateUnits([
			{ componentIds: ['a', 'b'], unitKind: 'source-element-group' },
			{ componentIds: ['b', 'a'], unitKind: 'source-element-group' },
			{ componentIds: ['a'], unitKind: 'component' },
		]);

		expect(units).toEqual([
			{ componentIds: ['a', 'b'], unitKind: 'source-element-group' },
			{ componentIds: ['a'], unitKind: 'component' },
		]);
	});

	it('offers adjacent same-color glyph halves as one optional candidate', function() {
		const runner = new OptionalPartAssignmentRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'season-3',
			components: [
				normalizedComponent('glyph-left', box(78, 4, 88, 20), { sourceIndex: 0, fill: '#993300' }),
				normalizedComponent('glyph-right', box(86, 4, 96, 20), { sourceIndex: 1, fill: '#993300' }),
				normalizedComponent('same-color-art', box(50, 45, 60, 75), { sourceIndex: 2, fill: '#993300' }),
				normalizedComponent('label', box(4, 4, 14, 18), { sourceIndex: 3, fill: '#111' }),
			],
		}));

		expect(bindingSuggestionForPart(artifact, 'glyph').componentIds).toEqual(['glyph-left', 'glyph-right']);
		expect(artifact.optionalParts.glyph.candidates[0]).toEqual(jasmine.objectContaining({
			unitKind: 'same-color-neighbor-group',
			componentIds: ['glyph-left', 'glyph-right'],
		}));
		expect(artifact.optionalParts.glyph.candidates[0].reasons).toContain('same-color-neighbor-group');
	});

	it('prefers a split source glyph over a single high-position fragment', function() {
		const runner = new OptionalPartAssignmentRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'season-3',
			alignmentBounds: box(0, 0, 200, 140),
			components: [
				normalizedComponent('glyph-left', box(88, 4, 119, 61), {
					sourceIndex: 0,
					fill: '#bf3718',
					parentComponentId: 'glyph-source',
				}),
				normalizedComponent('glyph-right', box(112, 4, 158, 59), {
					sourceIndex: 0,
					fill: '#bf3718',
					parentComponentId: 'glyph-source',
				}),
				normalizedComponent('label', box(4, 4, 26, 46), { sourceIndex: 1, fill: '#2a3b92' }),
			],
		}));

		expect(bindingSuggestionForPart(artifact, 'glyph').componentIds).toEqual(['glyph-left', 'glyph-right']);
		expect(artifact.optionalParts.glyph.candidates[0]).toEqual(jasmine.objectContaining({
			unitKind: 'source-element-group',
			componentIds: ['glyph-left', 'glyph-right'],
		}));
		expect(artifact.optionalParts.glyph.candidates[0].reasons).toContain('split-source-element-group');
	});

	it('does not promote broad same-color artwork groups above a stronger glyph candidate', function() {
		const runner = new OptionalPartAssignmentRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'season-4',
			alignmentBounds: box(0, 0, 100, 140),
			components: [
				normalizedComponent('glyph-candidate', box(82, 4, 98, 24), { sourceIndex: 0, fill: '#993300' }),
				normalizedComponent('same-color-art-a', box(42, 8, 45, 12), { sourceIndex: 1, fill: '#336633' }),
				normalizedComponent('same-color-art-b', box(44, 20, 48, 34), { sourceIndex: 2, fill: '#336633' }),
				normalizedComponent('same-color-art-c', box(46, 38, 50, 56), { sourceIndex: 3, fill: '#336633' }),
				normalizedComponent('label', box(4, 4, 16, 24), { sourceIndex: 4, fill: '#111' }),
			],
		}));

		expect(bindingSuggestionForPart(artifact, 'glyph').componentIds).toEqual(['glyph-candidate']);
		expect(artifact.optionalParts.glyph.candidates[0]).toEqual(jasmine.objectContaining({
			unitKind: 'component',
			componentIds: ['glyph-candidate'],
		}));
		expect(artifact.optionalParts.glyph.candidates.some((candidate) => candidate.unitKind === 'same-color-source-group')).toBe(true);
	});

	it('does not bind expected labels without text or OCR evidence', function() {
		const runner = new OptionalPartAssignmentRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'b-8',
			alignmentBounds: box(0, 0, 100, 100),
			components: [
				normalizedComponent('bamboo-a', box(15, 10, 45, 45), {
					sourceIndex: 0,
					fill: '#080',
					labelOcr: nonMatchingLabelOcr('bamboo-a', '8'),
				}),
				normalizedComponent('bamboo-b', box(55, 10, 85, 45), {
					sourceIndex: 1,
					fill: '#080',
					labelOcr: nonMatchingLabelOcr('bamboo-b', '8'),
				}),
				normalizedComponent('bamboo-c', box(15, 55, 45, 90), {
					sourceIndex: 2,
					fill: '#080',
					labelOcr: nonMatchingLabelOcr('bamboo-c', '8'),
				}),
				normalizedComponent('bamboo-d', box(55, 55, 85, 90), {
					sourceIndex: 3,
					fill: '#080',
					labelOcr: nonMatchingLabelOcr('bamboo-d', '8'),
				}),
			],
		}));

		expect(bindingSuggestionForPart(artifact, 'label')).toBeUndefined();
		expect(artifact.optionalParts.label.sourceState).toBe('needs-review');
		expect(artifact.optionalParts.label.candidates[0].score).toBeLessThan(0.55);
		expect(artifact.optionalParts.label.candidates[0].reasons).toContain('missing-expected-label-evidence');
	});

	it('does not treat the opposite top corner as compatible with a corner hint', function() {
		const runner = new OptionalPartAssignmentRunner();
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'season-1',
			alignmentBounds: box(0, 0, 200, 140),
			components: [
				normalizedComponent('label', box(4, 4, 26, 46), { sourceIndex: 0, fill: '#2a3b92' }),
				normalizedComponent('glyph', box(128, 4, 199, 71), { sourceIndex: 1, fill: '#bf3718' }),
			],
		}));

		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['label']);
		expect(bindingSuggestionForPart(artifact, 'glyph')).toBeUndefined();
		expect(artifact.optionalParts.glyph.sourceState).toBe('needs-review');
		expect(artifact.optionalParts.glyph.strength).toBe('none');
	});

	it('handles absent optional parts when there are no source components or alignment bounds', function() {
		const runner = new OptionalPartAssignmentRunner({ rootDir: path.resolve('test-root') });
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
			alignmentBounds: null,
		}));

		expect(artifact.status).toBe('ready');
		expect(artifact.sourceBounds).toBeNull();
		expect(artifact.optionalParts.label.sourceState).toBe('source-absent');
		expect(artifact.metadataSeed.glyphLayout.label.outputPresent).toBeUndefined();
		expect(artifact.bindingSuggestions).toEqual([]);
	});

	it('makes source-metadata optional labels available while unannotated faces stay unlabeled', function() {
		const runner = new OptionalPartAssignmentRunner({ rootDir: path.resolve('test-root') });
		const labelComponent = normalizedComponent('dragon-label', box(84, 4, 94, 18));
		const redArtifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			tilesetId: 'traditional',
			faceKey: 'dragon-r',
			components: [labelComponent],
			sourceMetadata: dragonLabelSourceMetadata(),
		}));
		const greenArtifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			tilesetId: 'traditional',
			faceKey: 'dragon-g',
			components: [labelComponent],
			sourceMetadata: dragonLabelSourceMetadata(),
		}));
		const whiteArtifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			tilesetId: 'traditional',
			faceKey: 'dragon-w',
			components: [labelComponent],
			sourceMetadata: dragonLabelSourceMetadata({ searchSource: false, outputPresent: false }),
		}));

		expect(redArtifact.optionalParts.label).toEqual(jasmine.objectContaining({
			role: 'dragon-label',
			sourceState: 'candidate-found',
		}));
		expect(redArtifact.optionalParts.label.hint.region).toBe('top-right');
		expect(bindingSuggestionForPart(redArtifact, 'label').componentIds).toEqual(['dragon-label']);
		expect(greenArtifact.optionalParts.label).toEqual(jasmine.objectContaining({
			role: 'dragon-label',
			sourceState: 'candidate-found',
		}));
		expect(whiteArtifact.optionalParts.label).toEqual(jasmine.objectContaining({
			role: 'dragon-label',
			expected: true,
			sourceState: 'candidate-found',
		}));
		expect(whiteArtifact.optionalParts.label.outputPresent).toBeUndefined();
		expect(bindingSuggestionForPart(whiteArtifact, 'label').componentIds).toEqual(['dragon-label']);
	});

	it('keeps explicit source parsing and rendering metadata independent', function() {
		const runner = new OptionalPartAssignmentRunner({ rootDir: path.resolve('test-root') });
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			tilesetId: 'traditional',
			faceKey: 'dragon-r',
			components: [
				normalizedComponent('source-label', box(84, 4, 94, 18)),
			],
			sourceMetadata: {
				sourceParsing: {
					optionalParts: {
						label: {
							contentKind: 'label',
							role: 'dragon-label',
							region: 'top-right',
							metadataKey: 'label',
							searchSource: false,
						},
					},
				},
				rendering: {
					parts: {
						label: {
							contentKind: 'label',
							role: 'dragon-label',
							source: 'generated',
							renderMode: 'generated',
							outputPresent: true,
						},
					},
				},
			},
		}));

		expect(artifact.optionalParts.label).toEqual(jasmine.objectContaining({
			expected: true,
			sourceState: 'candidate-found',
		}));
		expect(bindingSuggestionForPart(artifact, 'label').componentIds).toEqual(['source-label']);
	});

	it('keeps source metadata output layout out of optional parsing artifacts', function() {
		const runner = new OptionalPartAssignmentRunner({ rootDir: path.resolve('test-root') });
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			tilesetId: 'default',
			faceKey: 'dragon-r',
			components: [
				normalizedComponent('dragon-artwork', box(24, 18, 74, 112)),
			],
			sourceMetadata: {
				outputOptions: {
					layout: {
						scaleMode: 'largest-containing-box',
					},
				},
			},
		}));

		expect(artifact.optionalParts.label).toBeDefined();
		expect(artifact.outputOptions).toBeUndefined();
	});

	it('uses UI manual assignments as optional-part reservations after scoring', function() {
		const runner = new OptionalPartAssignmentRunner({ rootDir: path.resolve('test-root') });
		const artifact = runner.buildOptionalPartArtifact(makeArtifactInput({
			faceKey: 'season-3',
			components: [
				normalizedComponent('label-candidate', box(4, 4, 14, 20), { sourceIndex: 0, fill: '#224' }),
				normalizedComponent('glyph-left', box(52, 6, 64, 32), {
					sourceIndex: 1,
					fill: '#b22',
					parentComponentId: 'src-element.glyph',
				}),
				normalizedComponent('glyph-right', box(72, 6, 88, 32), {
					sourceIndex: 1,
					fill: '#b22',
					parentComponentId: 'src-element.glyph',
				}),
				normalizedComponent('body-art', box(20, 60, 80, 125), { sourceIndex: 2, fill: '#070' }),
			],
			manualAssignments: {
				faces: {
					'season-3': {
						glyph: ['glyph-left', 'glyph-right'],
					},
				},
			},
		}));

		expect(bindingSuggestionForPart(artifact, 'glyph').componentIds).toEqual(['glyph-left', 'glyph-right']);
		expect(artifact.optionalParts.glyph.candidates[0]).toEqual(jasmine.objectContaining({
			unitKind: 'manual-source-selection',
			componentIds: ['glyph-left', 'glyph-right'],
			score: 1,
			strength: 'strong',
			reviewStatus: 'reviewed',
			reasons: ['manual-ui-selection'],
		}));
		expect(bindingSuggestionForPart(artifact, 'glyph')).toEqual(jasmine.objectContaining({
			componentIds: ['glyph-left', 'glyph-right'],
			strength: 'strong',
			reviewStatus: 'reviewed',
		}));
		expect(artifact.optionalParts.glyph.strength).toBe('strong');
		expect(artifact.optionalParts.glyph.reviewStatus).toBe('reviewed');
	});
});

function fakeFileSystem(initialFiles = {}) {
	const files = new Map(Object.entries(initialFiles));
	const directories = [];
	const writes = [];

	return {
		files,
		directories,
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
		async mkdir(dirPath) {
			directories.push(dirPath);
		},
	};
}

function normalizedArtifact(faceKey, components, overrides = {}) {
	return {
		faceKey,
		sourceFile: `scripts/data/3d-assets/sprite-source-svgs/wiki/${faceKey}.svg`,
		alignmentComponentIds: components.map((component) => component.componentId),
		alignmentBounds: getUnionBounds(components),
		components,
		...overrides,
	};
}

function canonicalTestStatePath(rootDir, tilesetId) {
	return path.resolve(rootDir, 'scripts', 'output', '3d-assets', 'svg-preprocessor', tilesetId, 'tileset.json');
}

function canonicalFaceState(sourceSvg, normalizedComponents) {
	return {
		artifacts: {
			sourceSvg,
			normalizedComponents: normalizeForTest(path.resolve('test-root'), normalizedComponents),
		},
		state: {},
		stages: {},
	};
}

function bindingSuggestionForPart(artifact, partId) {
	return artifact.bindingSuggestions.find((suggestion) => suggestion.partId === partId);
}

function normalizedComponent(componentId, bounds, overrides = {}) {
	return {
		componentId,
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		area: bounds.width * bounds.height,
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

function nonMatchingLabelOcr(componentId, expectedLabel) {
	return {
		source: 'label-ocr-template',
		sourceId: componentId,
		componentIds: [componentId],
		expectedLabel,
		templateId: `digit-${expectedLabel}`,
		pixelMeanAbsoluteError: 0.42,
		candidateDarkness: 0.5,
		templateDarkness: 0.4,
		threshold: 0.3,
		match: false,
	};
}

function candidateUnit(componentId, bounds, overrides = {}) {
	return {
		unitKind: 'component',
		componentIds: [componentId],
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		normalizedCenter: {
			x: 0.5,
			y: 0.5,
		},
		sourceOrder: 0,
		componentCount: 1,
		componentLevel: 'element',
		classNames: [],
		fills: [],
		areaRatio: bounds.area / 14000,
		...overrides,
	};
}

function makeArtifactInput({
	tilesetId = 'wiki',
	faceKey,
	components,
	bulkOptions = null,
	manualAssignments = null,
	alignmentBounds = box(0, 0, 100, 140),
	sourceMetadata = {},
}) {
	const rootDir = path.resolve('test-root');

	return {
		tilesetId,
		faceKey,
		generatedOn: '2026-05-03T12:00:00.000Z',
		normalizedPath: path.resolve(rootDir, 'normalized-components', `${faceKey}.json`),
		sourceFile: `scripts/data/3d-assets/sprite-source-svgs/${tilesetId}/${faceKey}.svg`,
		normalized: {
			sourceFile: `scripts/data/3d-assets/sprite-source-svgs/${tilesetId}/${faceKey}.svg`,
			sourceMetadata,
			alignmentComponentIds: components.map((item) => item.componentId),
			alignmentBounds,
			components,
		},
		bulkOptions,
		manualAssignments,
	};
}

function dragonLabelSourceMetadata(overrides = {}) {
	const {
		searchSource = true,
		outputPresent = true,
		source = 'default-on',
	} = overrides;

	return {
		sourceParsing: {
			optionalParts: {
				label: {
					contentKind: 'label',
					role: 'dragon-label',
					region: 'top-right',
					metadataKey: 'label',
					searchSource,
				},
			},
		},
		rendering: {
			parts: {
				label: {
					contentKind: 'label',
					role: 'dragon-label',
					source,
					outputPresent,
				},
			},
		},
	};
}

function getUnionBounds(components) {
	const left = Math.min(...components.map((component) => component.bounds.left));
	const top = Math.min(...components.map((component) => component.bounds.top));
	const right = Math.max(...components.map((component) => component.bounds.right));
	const bottom = Math.max(...components.map((component) => component.bounds.bottom));

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

function normalizedArtifactPath(output3dDir, tilesetId, faceKey) {
	return path.resolve(output3dDir, 'svg-preprocessor', tilesetId, 'normalized-components', `${faceKey}.json`);
}

function optionalArtifactPath(output3dDir, tilesetId, faceKey) {
	return path.resolve(output3dDir, 'svg-preprocessor', tilesetId, 'optional-parts', `${faceKey}.json`);
}

function normalizeForTest(rootDir, filePath) {
	return path.relative(rootDir, filePath).replaceAll('\\', '/');
}
