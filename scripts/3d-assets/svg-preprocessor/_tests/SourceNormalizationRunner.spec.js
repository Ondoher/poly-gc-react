import path from 'path';
import sharp from 'sharp';
import { BASE_OUTPUT } from '../PipelineModel.js';
import { SourceNormalizationRunner } from '../SourceNormalizationRunner.js';
import { testPipelineModelFromFile } from './test-pipeline-model.js';

describe('SourceNormalizationRunner', function() {
	it('processes a requested face and writes normalized artifacts, report, and state', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const sourcePath = path.resolve(rootDir, 'source', 'b-1.svg');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: {
					'b-1': canonicalFaceState('source/b-1.svg'),
					'b-2': canonicalFaceState('source/b-2.svg'),
				},
			}),
			[sourcePath]: '<svg/>',
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
			extractComponents: () => ({
				viewBox: { minX: 0, minY: 0, width: 100, height: 140 },
				groups: ['art'],
				components: [
					extractedComponent('tile', box(0, 0, 100, 140), { tileLayerCandidate: true }),
					extractedComponent('invisible', box(5, 5, 95, 135), { fill: 'none', stroke: 'none' }),
					extractedComponent('paint', box(20, 20, 60, 80), { className: 'paint-red', fill: '#d00' }),
					extractedComponent('cutout', box(30, 30, 40, 40), { fill: '#fff', negativeSpaceCandidate: true }),
				],
			}),
		});

		const summary = await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
			faceKey: 'b-1',
		});

		const artifactPath = pipelineArtifactPath('wiki', 'json', 'normalized-components', 'b-1.json');
		const identifiedSvgPath = pipelineArtifactPath('wiki', 'images', 'identified-components-svg', 'b-1.svg');
		const identifiedShapesSvgPath = pipelineArtifactPath('wiki', 'images', 'identified-shapes-svg', 'b-1.svg');
		const reportPath = pipelineArtifactPath('wiki', 'reports', 'source-normalization-report.b-1.json');
		const artifact = JSON.parse(fs.files.get(artifactPath));
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual({
			tilesetId: 'wiki',
			faceCount: 1,
			faceKey: 'b-1',
			componentCount: 4,
			alignmentComponentCount: 1,
			shapeCount: 4,
			alignmentShapeCount: 1,
			componentsDir: normalizeForTest(rootDir, path.dirname(artifactPath)),
			reportPath: normalizeForTest(rootDir, reportPath),
			warningCount: 0,
		});
		expect(artifact.alignmentComponentIds).toEqual(['src.b-1.0003']);
		expect(artifact.alignmentShapeIds).toEqual(['shape.b-1.0003']);
		expect(artifact.sourceShapes.map((shape) => shape.componentIds)).toEqual([
			['src.b-1.0001'],
			['src.b-1.0002'],
			['src.b-1.0003'],
			['src.b-1.0004'],
		]);
		expect(artifact.status).toBe('ready');
		expect(artifact.components.map((component) => component.sourceElementId)).toEqual(['tile', 'invisible', 'paint', 'cutout']);
		expect(fs.files.get(identifiedSvgPath)).toContain('data-component-id="src.b-1.0003"');
		expect(fs.files.get(identifiedSvgPath)).not.toContain('data-component-id="src.b-1.0001"');
		expect(fs.files.get(identifiedSvgPath)).not.toContain('data-component-id="src.b-1.0002"');
		expect(artifact.identifiedShapesSvg).toBe(normalizeForTest(rootDir, identifiedShapesSvgPath));
		expect(fs.files.get(identifiedShapesSvgPath)).toContain('data-shape-id="shape.b-1.0003"');
		expect(fs.files.get(identifiedShapesSvgPath)).toContain('data-shape-box="shape.b-1.0003"');
		expect(fs.files.get(identifiedShapesSvgPath)).not.toContain('data-shape-id="shape.b-1.0001"');
		expect(fs.files.get(identifiedShapesSvgPath)).not.toContain('data-shape-id="shape.b-1.0002"');
		const state = JSON.parse(fs.files.get(statePath));
		expect(report.faceCount).toBe(1);
		expect(report.faces['b-1']).toEqual(jasmine.objectContaining({
			status: 'ready',
			identifiedShapesSvg: normalizeForTest(rootDir, identifiedShapesSvgPath),
			componentCount: 4,
			alignmentComponentCount: 1,
			shapeCount: 4,
			alignmentShapeCount: 1,
		}));
		expect(fs.writes.filter((write) => [artifactPath, identifiedSvgPath, identifiedShapesSvgPath, reportPath].includes(write.filePath))
			.every((write) => write.encoding === 'utf8')).toBe(true);
		expect(Object.keys(report.faces)).toEqual(['b-1']);
		expect(state.svgPipeline.faces['b-1'].artifacts.normalizedComponents).toBe(artifactPath.replaceAll('\\', '/'));
	});

	it('records missing source SVGs without stopping the report', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const missingSourcePath = path.resolve(rootDir, 'source', 'missing.svg');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: {
					'wind-n': canonicalFaceState('source/missing.svg'),
				},
			}),
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
			extractComponents: () => {
				throw new Error('extractor should not run for missing source');
			},
		});

		const summary = await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
		});
		const reportPath = pipelineArtifactPath('wiki', 'reports', 'source-normalization-report.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary.warningCount).toBe(1);
		expect(summary.componentCount).toBe(0);
		expect(report.warnings).toEqual([{
			code: 'missing-source-svg',
			faceKey: 'wind-n',
			sourceFile: normalizeForTest(rootDir, missingSourcePath),
		}]);
		expect(report.faces['wind-n']).toEqual({
			status: 'missing-source-svg',
			sourceFile: normalizeForTest(rootDir, missingSourcePath),
			componentCount: 0,
			alignmentComponentCount: 0,
			shapeCount: 0,
			alignmentShapeCount: 0,
		});
		expect(JSON.parse(fs.files.get(statePath)).svgPipeline.faces['wind-n'].artifacts.normalizedComponents).toBeUndefined();
	});

	it('carries source defs into identified preview SVGs', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'classic');
		const sourcePath = path.resolve(rootDir, 'source', 'b-8.svg');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'classic',
				faces: {
					'b-8': canonicalFaceState('source/b-8.svg'),
				},
			}),
			[sourcePath]: `<svg viewBox="0 0 100 100">
				<defs><linearGradient id="linearGradient8797"/></defs>
			</svg>`,
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
			extractComponents: () => ({
				viewBox: { minX: 0, minY: 0, width: 100, height: 100 },
				components: [
					extractedComponent('gradient-paint', box(10, 10, 40, 40), {
						fill: 'url(#linearGradient8797)',
					}),
				],
			}),
		});

		await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
			faceKey: 'b-8',
		});

		const identifiedSvgPath = pipelineArtifactPath('classic', 'images', 'identified-components-svg', 'b-8.svg');
		const identifiedShapesSvgPath = pipelineArtifactPath('classic', 'images', 'identified-shapes-svg', 'b-8.svg');

		expect(fs.files.get(identifiedSvgPath)).toContain('<defs><linearGradient id="linearGradient8797"/></defs>');
		expect(fs.files.get(identifiedSvgPath)).toContain('fill="url(#linearGradient8797)"');
		expect(fs.files.get(identifiedShapesSvgPath)).toContain('<defs><linearGradient id="linearGradient8797"/></defs>');
		expect(fs.files.get(identifiedShapesSvgPath)).toContain('fill="url(#linearGradient8797)"');
	});

	it('flattens overlapping opaque paint layers into visible source geometry', function() {
		const runner = new SourceNormalizationRunner();
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'wiki',
			faceKey: 'flower-1',
			sourceFile: path.resolve('test-root/source/flower-1.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				viewBox: { minX: 0, minY: 0, width: 20, height: 20 },
				components: [
					extractedComponent('lower-red', box(0, 0, 10, 10), { fill: '#c20000' }),
					extractedComponent('upper-green', box(2, 2, 8, 8), { fill: '#21a126' }),
				],
			},
		});
		const lower = artifact.components.find((component) => component.sourceElementId === 'lower-red');
		const upper = artifact.components.find((component) => component.sourceElementId === 'upper-green');

		expect(lower.flattenedPaintLayer).toBe(true);
		expect(lower.paintLayerFlattening.occludingComponentIds).toEqual(['src.flower-1.0002']);
		expect(lower.transform).toBeNull();
		expect(lower.bounds).toEqual(jasmine.objectContaining({
			left: 0,
			top: 0,
			right: 10,
			bottom: 10,
			width: 10,
			height: 10,
		}));
		expect(upper.flattenedPaintLayer).toBeUndefined();
		expect(artifact.alignmentComponentIds).toEqual(['src.flower-1.0001', 'src.flower-1.0002']);
	});

	it('does not flatten overlap between separately identified source shapes', function() {
		const runner = new SourceNormalizationRunner();
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'traditional',
			faceKey: 'd-7',
			sourceFile: path.resolve('test-root/source/d-7.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				viewBox: { minX: 0, minY: 0, width: 30, height: 20 },
				components: [
					extractedComponent('left-dot', box(0, 0, 12, 12), { fill: '#069200' }),
					extractedComponent('right-dot', box(8, 0, 20, 12), { fill: '#5be335' }),
				],
			},
		});
		const left = artifact.components.find((component) => component.sourceElementId === 'left-dot');
		const right = artifact.components.find((component) => component.sourceElementId === 'right-dot');

		expect(left.flattenedPaintLayer).toBeUndefined();
		expect(left.paintLayerFlattening).toBeUndefined();
		expect(left.pathData).toBe('M0,0 H12 V12 H0 Z');
		expect(right.flattenedPaintLayer).toBeUndefined();
	});

	it('does not flatten fragments from the same source paint element into each other', function() {
		const runner = new SourceNormalizationRunner();
		const sourceUseInstance = {
			sourceUseId: 'path3478',
			sourceUseInstanceId: 'source-use.0002.path3478',
		};
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'traditional',
			faceKey: 'c-5',
			sourceFile: path.resolve('test-root/source/c-5.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				viewBox: { minX: 0, minY: 0, width: 100, height: 140 },
				components: [
					extractedComponent('top-fragment', box(10, 10, 30, 30), {
						fill: '#c20000',
						fillRule: 'evenodd',
						sourceElementComponentId: 'src-element.0006',
						sourceUseId: 'path3478',
						sourceUseInstanceId: 'source-use.0002.path3478',
						sourceUseInstances: [sourceUseInstance],
						pathData: 'M10,10 H30 V30 H10 Z M15,15 H25 V25 H15 Z',
					}),
					extractedComponent('main-fragment', box(12, 20, 40, 50), {
						fill: '#c20000',
						fillRule: 'evenodd',
						sourceElementComponentId: 'src-element.0006',
						sourceUseId: 'path3478',
						sourceUseInstanceId: 'source-use.0002.path3478',
						sourceUseInstances: [sourceUseInstance],
						pathData: 'M12,20 H40 V50 H12 Z',
					}),
				],
			},
		});

		const top = artifact.components.find((component) => component.sourceElementId === 'top-fragment');
		const main = artifact.components.find((component) => component.sourceElementId === 'main-fragment');

		expect(top.flattenedPaintLayer).toBeUndefined();
		expect(top.paintLayerFlattening).toBeUndefined();
		expect(top.pathData).toContain('M15,15');
		expect(main.flattenedPaintLayer).toBeUndefined();
	});

	it('emits manifest metadata output options during source normalization', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const sourcePath = path.resolve(rootDir, 'source', 'dragon-r.svg');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: {
					'dragon-r': canonicalFaceState('source/dragon-r.svg', {
						sourceMetadata: {
							outputOptions: {
								layout: {
									scaleMode: 'largest-containing-box',
								},
							},
						},
					}),
				},
			}),
			[sourcePath]: '<svg/>',
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
			extractComponents: () => extractionWithOnePaintComponent(),
		});

		await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
		});

		const artifact = JSON.parse(fs.files.get(pipelineArtifactPath('wiki', 'json', 'normalized-components', 'dragon-r.json')));
		expect(artifact.sourceMetadata.outputOptions.layout.scaleMode).toBe('largest-containing-box');
	});

	it('marks faces with no alignment components as needs review', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'custom');
		const sourcePath = path.resolve(rootDir, 'source', 'blank.svg');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'custom',
				faces: {
					'blank': canonicalFaceState('source/blank.svg'),
				},
			}),
			[sourcePath]: '<svg/>',
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			clock: () => '2026-05-03T12:00:00.000Z',
			extractComponents: () => ({
				viewBox: { minX: 0, minY: 0, width: 100, height: 140 },
				components: [
					extractedComponent('tile', box(0, 0, 100, 140), { tileLayerCandidate: true }),
				],
			}),
		});

		await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
			tilesetId: 'custom',
		});

		const artifactPath = pipelineArtifactPath('custom', 'json', 'normalized-components', 'blank.json');
		const artifact = JSON.parse(fs.files.get(artifactPath));

		expect(artifact.status).toBe('needs-review');
		expect(artifact.alignmentComponentIds).toEqual([]);
		expect(artifact.alignmentBounds).toBeNull();
		expect(artifact.diagnostics).toEqual([{
			level: 'warning',
			code: 'no-alignment-components',
			message: 'No source components remain after tile-layer and negative-space filtering.',
		}]);
		const state = JSON.parse(fs.files.get(statePath));
		expect(state.svgPipeline.faces.blank.artifacts.normalizedComponents).toBe(artifactPath.replaceAll('\\', '/'));
	});

	it('processes full manifest runs in sorted face-key order', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: {
					'wind-n': canonicalFaceState('source/wind-n.svg'),
					'b-1': canonicalFaceState('source/b-1.svg'),
					'd-3': canonicalFaceState('source/d-3.svg'),
				},
			}),
			[path.resolve(rootDir, 'source', 'wind-n.svg')]: '<svg/>',
			[path.resolve(rootDir, 'source', 'b-1.svg')]: '<svg/>',
			[path.resolve(rootDir, 'source', 'd-3.svg')]: '<svg/>',
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			extractComponents: () => extractionWithOnePaintComponent(),
		});

		await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
		});

		const reportPath = pipelineArtifactPath('wiki', 'reports', 'source-normalization-report.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(Object.keys(report.faces)).toEqual(['b-1', 'd-3', 'wind-n']);
		const state = JSON.parse(fs.files.get(statePath));
		expect(Object.keys(state.svgPipeline.faces).sort()).toEqual(['b-1', 'd-3', 'wind-n']);
	});

	it('uses tileset id from options before canonical state tileset id', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const explicitStatePath = canonicalTestStatePath(rootDir, 'from-options');
		const stateTilesetPath = canonicalTestStatePath(rootDir, 'from-state');
		const fs = fakeFileSystem({
			[explicitStatePath]: JSON.stringify({ tilesetId: 'from-state', faces: {} }),
			[stateTilesetPath]: JSON.stringify({ tilesetId: 'from-state', faces: {} }),
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
		});

		const explicit = await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath: explicitStatePath }),
			tilesetId: 'from-options',
		});
		const state = await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath: stateTilesetPath }),
		});

		expect(explicit.tilesetId).toBe('from-state');
		expect(state.tilesetId).toBe('from-state');
	});

	it('formats stable component ids for elements and split subcomponents', function() {
		const rootDir = path.resolve('test-root');
		const runner = new SourceNormalizationRunner({ rootDir });
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'wiki',
			faceKey: 'b-3',
			sourceFile: path.resolve(rootDir, 'b-3.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				components: [
					extractedComponent('whole', box(0, 0, 10, 10), { sourceIndex: 0 }),
					extractedComponent('split-a', box(20, 0, 30, 10), {
						sourceIndex: 1,
						subcomponentIndex: 0,
						componentLevel: 'subcomponent',
						splitStrategy: 'compound-path-island',
					}),
					extractedComponent('split-b', box(40, 0, 50, 10), {
						sourceIndex: 1,
						subcomponentIndex: 1,
						componentLevel: 'subcomponent',
						splitStrategy: 'compound-path-island',
					}),
				],
			},
		});

		expect(artifact.components.map((component) => component.componentId)).toEqual([
			'src.b-3.0001',
			'src.b-3.0002.0001',
			'src.b-3.0002.0002',
		]);
		expect(artifact.components[1].parentComponentId).toBe('src.b-3.0002');
		expect(artifact.components[2].parentComponentId).toBe('src.b-3.0002');
		expect(artifact.sourceShapes.map((shape) => shape.componentIds)).toEqual([
			['src.b-3.0001'],
			['src.b-3.0002.0001'],
			['src.b-3.0002.0002'],
		]);
		expect(artifact.sourceShapes[1]).toEqual(jasmine.objectContaining({
			shapeId: 'shape.b-3.0002',
			componentCount: 1,
			sourceElementComponentId: 'src.b-3.0002',
			sourceElementComponentIds: ['src.b-3.0002'],
			cohesionReason: 'single-component',
			splittable: false,
		}));
		expect(artifact.sourceShapes[2]).toEqual(jasmine.objectContaining({
			shapeId: 'shape.b-3.0003',
			sourceElementComponentId: 'src.b-3.0002',
			sourceElementComponentIds: ['src.b-3.0002'],
			cohesionReason: 'single-component',
		}));
	});

	it('keeps compound-path-band subcomponents as separate source shapes even inside one source-use instance', function() {
		const rootDir = path.resolve('test-root');
		const runner = new SourceNormalizationRunner({ rootDir });
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'default',
			faceKey: 'd-6',
			sourceFile: path.resolve(rootDir, 'd-6.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				components: [
					extractedComponent('upper-dot', box(50, 40, 72, 62), {
						sourceIndex: 0,
						subcomponentIndex: 0,
						componentLevel: 'subcomponent',
						splitStrategy: 'compound-path-band',
						sourceUseInstances: [{
							sourceUseId: 'path3679',
							sourceUseInstanceId: 'source-use.0003.path3679',
						}],
					}),
					extractedComponent('lower-dot', box(50, 70, 72, 92), {
						sourceIndex: 0,
						subcomponentIndex: 1,
						componentLevel: 'subcomponent',
						splitStrategy: 'compound-path-band',
						sourceUseInstances: [{
							sourceUseId: 'path3679',
							sourceUseInstanceId: 'source-use.0003.path3679',
						}],
					}),
				],
			},
		});

		expect(artifact.sourceShapes.map((shape) => shape.componentIds)).toEqual([
			['src.d-6.0001.0001'],
			['src.d-6.0001.0002'],
		]);
		expect(artifact.alignmentShapeIds).toEqual(['shape.d-6.0001', 'shape.d-6.0002']);
	});

	it('keeps overlapping discrete source elements as separate shapes', function() {
		const rootDir = path.resolve('test-root');
		const runner = new SourceNormalizationRunner({ rootDir });
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'traditional',
			faceKey: 'd-7',
			sourceFile: path.resolve(rootDir, 'd-7.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				components: [
					extractedComponent('dot-a', box(10, 10, 30, 30), {
						sourceIndex: 0,
						fill: '#0505d1',
					}),
					extractedComponent('dot-b', box(24, 10, 44, 30), {
						sourceIndex: 1,
						fill: '#0505d1',
					}),
				],
			},
		});

		expect(artifact.sourceShapes.map((shape) => shape.componentIds)).toEqual([
			['src.d-7.0001'],
			['src.d-7.0002'],
		]);
		expect(artifact.alignmentShapeIds).toEqual(['shape.d-7.0001', 'shape.d-7.0002']);
	});

	it('groups contained layered components with shared ancestry as one shape', function() {
		const rootDir = path.resolve('test-root');
		const runner = new SourceNormalizationRunner({ rootDir });
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'traditional',
			faceKey: 'd-7',
			sourceFile: path.resolve(rootDir, 'd-7.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				components: [
					extractedComponent('dot-outer', box(10, 10, 31, 31), {
						sourceIndex: 0,
						fill: '#069200',
						parentGroupIds: ['ROD_7', 'dot-layer'],
					}),
					extractedComponent('dot-inner', box(12, 12, 29, 29), {
						sourceIndex: 1,
						fill: '#5be335',
						parentGroupIds: ['ROD_7', 'dot-layer'],
					}),
					extractedComponent('nearby-dot', box(28, 10, 49, 31), {
						sourceIndex: 2,
						fill: '#069200',
						parentGroupIds: ['ROD_7', 'dot-layer'],
					}),
				],
			},
		});

		expect(artifact.sourceShapes.map((shape) => shape.componentIds)).toEqual([
			['src.d-7.0001', 'src.d-7.0002'],
			['src.d-7.0003'],
		]);
		expect(artifact.sourceShapes[0]).toEqual(jasmine.objectContaining({
			componentCount: 2,
			cohesionReason: 'contained-layer',
			sourceElementComponentIds: ['src.d-7.0001', 'src.d-7.0002'],
		}));
		expect(artifact.alignmentShapeIds).toEqual(['shape.d-7.0001', 'shape.d-7.0002']);
	});

	it('groups contained layered components when the inner layer is earlier in source order', function() {
		const rootDir = path.resolve('test-root');
		const runner = new SourceNormalizationRunner({ rootDir });
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'traditional',
			faceKey: 'b-7',
			sourceFile: path.resolve(rootDir, 'b-7.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				components: [
					extractedComponent('bamboo-inner', box(12, 10, 28, 40), {
						sourceIndex: 0,
						fill: '#5be335',
						parentGroupIds: ['BAMBOO_7', 'bamboo-copy'],
					}),
					extractedComponent('bamboo-outer', box(10, 9, 30, 41), {
						sourceIndex: 1,
						fill: '#069200',
						parentGroupIds: ['BAMBOO_7', 'bamboo-copy'],
					}),
				],
			},
		});

		expect(artifact.sourceShapes.map((shape) => shape.componentIds)).toEqual([
			['src.b-7.0001', 'src.b-7.0002'],
		]);
		expect(artifact.sourceShapes[0]).toEqual(jasmine.objectContaining({
			componentCount: 2,
			cohesionReason: 'contained-layer',
		}));
	});

	it('groups one expanded source-use instance as one shape before contained-layer splitting', function() {
		const rootDir = path.resolve('test-root');
		const runner = new SourceNormalizationRunner({ rootDir });
		const sourceUseInstance = {
			sourceUseId: 'g12880',
			sourceUseInstanceId: 'source-use.0001.g12880',
		};
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'classic',
			faceKey: 'b-5',
			sourceFile: path.resolve(rootDir, 'b-5.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				components: [
					extractedComponent('body', box(10, 10, 24, 42), {
						sourceIndex: 0,
						fill: 'url(#body)',
						tileLayerCandidate: true,
						parentGroupIds: ['BAMBOO_5', 'g12880', 'g11985'],
						sourceUseId: 'g12880',
						sourceUseInstanceId: 'source-use.0001.g12880',
						sourceUseInstances: [sourceUseInstance],
					}),
					extractedComponent('cap', box(10, 10, 24, 17), {
						sourceIndex: 1,
						fill: '#108431',
						parentGroupIds: ['BAMBOO_5', 'g12880', 'g11985'],
						sourceUseId: 'g12880',
						sourceUseInstanceId: 'source-use.0001.g12880',
						sourceUseInstances: [sourceUseInstance],
					}),
					extractedComponent('band', box(10, 22, 24, 25), {
						sourceIndex: 2,
						fill: '#5c003f',
						parentGroupIds: ['BAMBOO_5', 'g12880'],
						sourceUseId: 'g12880',
						sourceUseInstanceId: 'source-use.0001.g12880',
						sourceUseInstances: [sourceUseInstance],
					}),
					extractedComponent('outline', box(9, 9, 25, 43), {
						sourceIndex: 3,
						fill: 'none',
						stroke: 'black',
						parentGroupIds: ['BAMBOO_5', 'g12880'],
						sourceUseId: 'g12880',
						sourceUseInstanceId: 'source-use.0001.g12880',
						sourceUseInstances: [sourceUseInstance],
					}),
				],
			},
		});

		expect(artifact.sourceShapes.length).toBe(1);
		expect(artifact.sourceShapes[0]).toEqual(jasmine.objectContaining({
			componentIds: ['src.b-5.0001', 'src.b-5.0002', 'src.b-5.0003', 'src.b-5.0004'],
			componentCount: 4,
			cohesionReason: 'source-use-instance',
			sourceUseId: 'g12880',
			sourceUseInstanceId: 'source-use.0001.g12880',
		}));
		expect(artifact.alignmentShapeIds).toEqual(['shape.b-5.0001']);
	});

	it('uses the innermost expanded source-use instance as the repeated shape identity', function() {
		const rootDir = path.resolve('test-root');
		const runner = new SourceNormalizationRunner({ rootDir });
		const columnUse = {
			sourceUseId: 'g13056',
			sourceUseInstanceId: 'source-use.0001.g13056',
		};
		const bambooUseA = {
			sourceUseId: 'g12880',
			sourceUseInstanceId: 'source-use.0002.g12880',
		};
		const bambooUseB = {
			sourceUseId: 'g12880',
			sourceUseInstanceId: 'source-use.0003.g12880',
		};
		const artifact = runner.buildNormalizedFaceArtifact({
			tilesetId: 'classic',
			faceKey: 'b-9',
			sourceFile: path.resolve(rootDir, 'b-9.svg'),
			generatedOn: '2026-05-03T12:00:00.000Z',
			extracted: {
				components: [
					extractedComponent('first-body', box(10, 10, 24, 42), {
						sourceIndex: 0,
						fill: 'url(#body)',
						sourceUseId: 'g12880',
						sourceUseInstanceId: 'source-use.0002.g12880',
						sourceUseInstances: [columnUse, bambooUseA],
					}),
					extractedComponent('first-outline', box(9, 9, 25, 43), {
						sourceIndex: 1,
						fill: 'none',
						stroke: 'black',
						sourceUseId: 'g12880',
						sourceUseInstanceId: 'source-use.0002.g12880',
						sourceUseInstances: [columnUse, bambooUseA],
					}),
					extractedComponent('second-body', box(10, 50, 24, 82), {
						sourceIndex: 2,
						fill: 'url(#body)',
						sourceUseId: 'g12880',
						sourceUseInstanceId: 'source-use.0003.g12880',
						sourceUseInstances: [columnUse, bambooUseB],
					}),
					extractedComponent('second-outline', box(9, 49, 25, 83), {
						sourceIndex: 3,
						fill: 'none',
						stroke: 'black',
						sourceUseId: 'g12880',
						sourceUseInstanceId: 'source-use.0003.g12880',
						sourceUseInstances: [columnUse, bambooUseB],
					}),
				],
			},
		});

		expect(artifact.sourceShapes.map((shape) => shape.componentIds)).toEqual([
			['src.b-9.0001', 'src.b-9.0002'],
			['src.b-9.0003', 'src.b-9.0004'],
		]);
		expect(artifact.sourceShapes.map((shape) => shape.sourceUseInstanceId)).toEqual([
			'source-use.0002.g12880',
			'source-use.0003.g12880',
		]);
		expect(artifact.sourceShapes.map((shape) => shape.sourceUseId)).toEqual(['g12880', 'g12880']);
		expect(artifact.alignmentShapeIds).toEqual(['shape.b-9.0001', 'shape.b-9.0002']);
	});

	it('groups paint summary buckets and sorts them by descending total area', function() {
		const runner = new SourceNormalizationRunner();
		const summary = runner.summarizePaint([
			normalizedComponent('red-a', box(0, 0, 10, 10), { className: 'red', fill: '#d00', stroke: null }),
			normalizedComponent('blue', box(0, 0, 20, 20), { className: 'blue', fill: '#00f', stroke: null }),
			normalizedComponent('red-b', box(0, 0, 5, 10), { className: 'red', fill: '#d00', stroke: null }),
		]);

		expect(summary).toEqual([
			{ className: 'blue', fill: '#00f', stroke: null, count: 1, totalArea: 400 },
			{ className: 'red', fill: '#d00', stroke: null, count: 2, totalArea: 150 },
		]);
	});

	it('renders identified debug SVG paths with attributes, transforms, and escaping', function() {
		const runner = new SourceNormalizationRunner();
		const svg = runner.buildIdentifiedComponentsSvg({
			viewBox: { minX: 0, minY: 0, width: 100, height: 100 },
			alignmentComponentIds: ['src.face.0001'],
			alignmentBounds: box(0, 0, 100, 100),
			components: [
				normalizedComponent('src.face.0001', box(0, 0, 10, 10), {
					className: 'paint"&<red>',
					fill: '#d00',
					stroke: '#111',
					strokeWidth: '2',
					opacity: 0.5,
					pathData: 'M0,0 H10 V10 H0 Z',
					transform: { a: 1, b: 0, c: 0, d: 1, e: 3, f: 4 },
				}),
			],
		});

		expect(svg).toContain('data-component-id="src.face.0001"');
		expect(svg).toContain('class="paint&quot;&amp;&lt;red&gt;"');
		expect(svg).toContain('fill="#d00"');
		expect(svg).toContain('stroke="#111"');
		expect(svg).toContain('stroke-width="2"');
		expect(svg).toContain('opacity="0.5"');
		expect(svg).toContain('transform="matrix(1 0 0 1 3 4)"');
		expect(svg).toContain('d="M0,0 H10 V10 H0 Z"');
	});

	it('includes overlapping cutouts in debug SVG only under the area threshold', function() {
		const runner = new SourceNormalizationRunner();
		const svg = runner.buildIdentifiedComponentsSvg({
			viewBox: { minX: 0, minY: 0, width: 100, height: 100 },
			alignmentComponentIds: ['paint'],
			alignmentBounds: box(0, 0, 100, 100),
			components: [
				normalizedComponent('paint', box(0, 0, 100, 100), { pathData: 'M0,0 H100 V100 H0 Z' }),
				normalizedComponent('small-cutout', box(10, 10, 20, 20), {
					pathData: 'M10,10 H20 V20 H10 Z',
					classification: { tileLayerCandidate: false, negativeSpaceCandidate: true },
				}),
				normalizedComponent('large-cutout', box(0, 0, 100, 95), {
					pathData: 'M0,0 H100 V95 H0 Z',
					classification: { tileLayerCandidate: false, negativeSpaceCandidate: true },
				}),
			],
		});

		expect(svg).toContain('data-component-id="small-cutout"');
		expect(svg).not.toContain('data-component-id="large-cutout"');
	});

	it('calls the extractor with compound path splitting enabled', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const sourcePath = path.resolve(rootDir, 'source', 'b-1.svg');
		const extractCalls = [];
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: { 'b-1': canonicalFaceState('source/b-1.svg') },
			}),
			[sourcePath]: '<svg id="source"/>',
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			extractComponents: (svgSource, options) => {
				extractCalls.push({ svgSource, options });
				return extractionWithOnePaintComponent();
			},
		});

		await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
		});

		expect(extractCalls).toEqual([{
			svgSource: '<svg id="source"/>',
			options: { splitCompoundPaths: true },
		}]);
	});

	it('trims low-density edge mass before square-normalizing label OCR masks', async function() {
		const runner = new SourceNormalizationRunner();
		const looseComponent = normalizedComponent('loose', box(0, 0, 100, 100), {
			pathData: 'M40,10 H60 V90 H40 Z',
		});
		const tightComponent = normalizedComponent('tight', box(40, 10, 60, 90), {
			pathData: 'M40,10 H60 V90 H40 Z',
		});

		const looseMask = await runner.renderLabelOcrMask({
			bounds: looseComponent.bounds,
			components: [looseComponent],
		});
		const tightMask = await runner.renderLabelOcrMask({
			bounds: tightComponent.bounds,
			components: [tightComponent],
		});
		const looseDarkness = await runner.darknessFromBuffer(looseMask);
		const tightDarkness = await runner.darknessFromBuffer(tightMask);

		expect(runner.scoreLabelOcrDarkness(looseDarkness, tightDarkness).pixelMeanAbsoluteError).toBeLessThan(0.1);
		expect(await inkBoundsFromMask(looseMask)).toEqual({
			left: 1,
			top: 1,
			right: 48,
			bottom: 48,
		});
	});

	it('uses full-run and single-face report filenames', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'wiki');
		const sourcePath = path.resolve(rootDir, 'source', 'b-1.svg');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({
				tilesetId: 'wiki',
				faces: { 'b-1': canonicalFaceState('source/b-1.svg') },
			}),
			[sourcePath]: '<svg/>',
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			extractComponents: () => extractionWithOnePaintComponent(),
		});

		await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
		});
		await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
			faceKey: 'b-1',
		});

		expect(fs.files.has(pipelineArtifactPath('wiki', 'reports', 'source-normalization-report.json')))
			.toBe(true);
		expect(fs.files.has(pipelineArtifactPath('wiki', 'reports', 'source-normalization-report.b-1.json')))
			.toBe(true);
	});

	it('writes an empty report for manifests without faces', async function() {
		const rootDir = path.resolve('test-root');
		const output3dDir = path.resolve(rootDir, 'scripts', 'output', '3d-assets');
		const statePath = canonicalTestStatePath(rootDir, 'empty');
		const fs = fakeFileSystem({
			[statePath]: JSON.stringify({ tilesetId: 'empty', faces: {} }),
		});
		const runner = new SourceNormalizationRunner({
			fileSystem: fs,
			rootDir,
			output3dDir,
			extractComponents: () => {
				throw new Error('extractor should not run for empty manifest');
			},
		});

		const summary = await runner.run({
			pipelineModel: testPipelineModelFromFile({ fileSystem: fs, statePath }),
		});
		const reportPath = pipelineArtifactPath('empty', 'reports', 'source-normalization-report.json');
		const report = JSON.parse(fs.files.get(reportPath));

		expect(summary).toEqual({
			tilesetId: 'empty',
			faceCount: 0,
			faceKey: null,
			componentCount: 0,
			alignmentComponentCount: 0,
			shapeCount: 0,
			alignmentShapeCount: 0,
			componentsDir: normalizeForTest(rootDir, pipelineArtifactPath('empty', 'json', 'normalized-components')),
			reportPath: normalizeForTest(rootDir, reportPath),
			warningCount: 0,
		});
		expect(report.faces).toEqual({});
		expect(report.warnings).toEqual([]);
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

function canonicalTestStatePath(rootDir, tilesetId) {
	return path.resolve(rootDir, 'scripts', 'output', '3d-assets', 'svg-preprocessor', tilesetId, 'tileset.json');
}

function pipelineArtifactPath(tilesetId, ...segments) {
	return path.resolve(BASE_OUTPUT, tilesetId, ...segments);
}

function canonicalFaceState(sourceSvg, configuration = {}) {
	return {
		configuration,
		artifacts: {
			sourceSvg,
		},
		state: {},
		stages: {},
	};
}

function extractedComponent(id, bounds, overrides = {}) {
	return {
		id,
		tagName: 'path',
		className: null,
		fill: '#111',
		stroke: null,
		strokeWidth: null,
		fillRule: null,
		opacity: null,
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		area: bounds.width * bounds.height,
		parentGroupIds: [],
		transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
		sourceElement: `<path id="${id}"/>`,
		pathData: `M${bounds.left},${bounds.top} H${bounds.right} V${bounds.bottom} H${bounds.left} Z`,
		tileLayerCandidate: false,
		negativeSpaceCandidate: false,
		...overrides,
	};
}

function normalizedComponent(componentId, bounds, overrides = {}) {
	return {
		componentId,
		className: null,
		fill: '#111',
		stroke: null,
		strokeWidth: null,
		opacity: null,
		bounds,
		area: bounds.width * bounds.height,
		transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
		pathData: `M${bounds.left},${bounds.top} H${bounds.right} V${bounds.bottom} H${bounds.left} Z`,
		classification: {
			tileLayerCandidate: false,
			negativeSpaceCandidate: false,
		},
		...overrides,
	};
}

async function inkBoundsFromMask(mask) {
	const { data, info } = await sharp(mask)
		.removeAlpha()
		.greyscale()
		.raw()
		.toBuffer({ resolveWithObject: true });
	let left = info.width;
	let top = info.height;
	let right = -1;
	let bottom = -1;

	for (let y = 0; y < info.height; y += 1) {
		for (let x = 0; x < info.width; x += 1) {
			const value = data[(y * info.width) + x];

			if (value < 250) {
				left = Math.min(left, x);
				top = Math.min(top, y);
				right = Math.max(right, x);
				bottom = Math.max(bottom, y);
			}
		}
	}

	return { left, top, right, bottom };
}

function extractionWithOnePaintComponent() {
	return {
		viewBox: { minX: 0, minY: 0, width: 100, height: 140 },
		components: [
			extractedComponent('paint', box(10, 10, 20, 20)),
		],
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

function normalizeForTest(rootDir, filePath) {
	return path.relative(rootDir, filePath).replaceAll('\\', '/');
}

