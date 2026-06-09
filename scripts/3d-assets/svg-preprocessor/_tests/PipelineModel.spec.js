import { PipelineModel } from '../PipelineModel.js';

describe('PipelineModel', function() {
	describe('generated asset rendering hash inputs', function() {
		it('uses the resolved nested effective rendering options for one face', function() {
			const model = pipelineModelWithRendering({
				defaults: {
					color: {
						policy: 'reference-color',
					},
					transform: {
						reflectX: false,
						rotate: 0,
					},
					suits: {
						bamboo: {
							transform: {
								scale: 1,
							},
						},
					},
				},
				overrides: {
					faces: {
						'b-1': {
							transform: {
								reflectX: true,
							},
						},
					},
				},
			});

			expect(model.getEffectiveRenderingOptions('b-1')).toEqual({
				color: {
					policy: 'reference-color',
				},
				transform: {
					reflectX: true,
					rotate: 0,
					scale: 1,
				},
			});
			expect(model.getEffectiveRenderingOptions('b-2')).toEqual({
				color: {
					policy: 'reference-color',
				},
				transform: {
					reflectX: false,
					rotate: 0,
					scale: 1,
				},
			});
		});

		it('does not change a face hash when an overridden global option changes', function() {
			const first = pipelineModelWithRendering({
				defaults: {
					transform: {
						reflectX: false,
					},
				},
				overrides: {
					faces: {
						'b-1': {
							transform: {
								reflectX: true,
							},
						},
					},
				},
			});
			const second = pipelineModelWithRendering({
				defaults: {
					transform: {
						reflectX: true,
					},
				},
				overrides: {
					faces: {
						'b-1': {
							transform: {
								reflectX: true,
							},
						},
					},
				},
			});

			expect(first.hashAssetPipelineFaceInput('b-1')).toBe(second.hashAssetPipelineFaceInput('b-1'));
			expect(first.hashAssetPipelineFaceInput('b-2')).not.toBe(second.hashAssetPipelineFaceInput('b-2'));
		});
	});

	describe('generated asset queue planning', function() {
		it('queues faces against the selected base tile when generated assets are missing', function() {
			const model = pipelineModelWithRendering({});
			model.pipelineState.assetPipeline = {
				baseTileSelection: {
					variantId: 'classic-soft',
				},
				faces: {},
			};
			model.setFinalRenderingColorSvgPath('b-1', 'scripts/output/asset-pipeline/test/final-rendering/color/b-1.svg');
			model.setFinalRenderingColorSvgPath('b-2', 'scripts/output/asset-pipeline/test/final-rendering/color/b-2.svg');

			const plan = model.planAssetGeneration();

			expect(plan.baseTileVariantId).toBe('classic-soft');
			expect(plan.plannedFaces.map((face) => face.faceKey)).toEqual(['b-1', 'b-2']);
			expect(plan.skippedFaces).toEqual([]);
			expect(model.getAssetPipeline().faces['b-1'].status).toBe('queued');
			expect(model.getAssetPipeline().faces['b-1'].queue).toEqual({
				status: 'queued',
				baseTileVariantId: 'classic-soft',
			});
			expect(model.getAssetPipeline().faces['b-1'].stageHashes['preview-svg'])
				.toBe(model.hashAssetPipelineFaceInput('b-1'));
		});

		it('requeues previously current faces when the selected base tile changes', function() {
			const model = pipelineModelWithRendering({});
			model.pipelineState.assetPipeline = {
				baseTileSelection: {
					variantId: 'classic-soft',
				},
				faces: {},
			};
			model.setFinalRenderingColorSvgPath('b-1', 'scripts/output/asset-pipeline/test/final-rendering/color/b-1.svg');
			model.updateAssetGenerationFace('b-1', {
				inputHash: model.hashAssetPipelineFaceInput('b-1'),
				finalHash: model.hashAssetPipelineFinalInput('b-1', { baseTileVariantId: 'classic-soft' }),
				stageHashes: Object.fromEntries(['preview-svg', 'svg-cutter', 'stamped-body', 'colored-inlay', 'preview-png']
					.map((stageId) => [stageId, model.hashAssetGenerationStageInput('b-1', stageId, { baseTileVariantId: 'classic-soft' })])),
				artifacts: {
					cutterMetadata: 'scripts/output/asset-pipeline/test/asset-generation/b-1/cutter.json',
					stampedModel: 'scripts/output/asset-pipeline/test/asset-generation/b-1/stamped-body.glb',
					stampedMetadata: 'scripts/output/asset-pipeline/test/asset-generation/b-1/stamped-body.json',
					inlayModel: 'scripts/output/asset-pipeline/test/asset-generation/b-1/colored-inlay.glb',
					inlayMetadata: 'scripts/output/asset-pipeline/test/asset-generation/b-1/colored-inlay.json',
					previewPng: 'scripts/output/asset-pipeline/test/asset-generation/b-1/preview.png',
				},
			});

			model.setSelectedBaseTileVariantId('classic-sharp');
			const plan = model.planAssetGeneration({ faceKeys: ['b-1'] });

			expect(plan.plannedFaces.map((face) => face.faceKey)).toEqual(['b-1']);
			expect(model.getAssetPipeline().faces['b-1'].status).toBe('queued');
			expect(model.getAssetPipeline().faces['b-1'].queue.baseTileVariantId).toBe('classic-sharp');
		});
	});
});

function pipelineModelWithRendering(rendering) {
	const model = new PipelineModel({
		referenceName: 'default-large-faces',
		tileSetName: 'test',
	});
	model.pipelineState = {
		schemaVersion: 3,
		tilesetId: 'test',
		rendering,
		svgPipeline: {
			faces: {
				'b-1': pipelineFace('b-1'),
				'b-2': pipelineFace('b-2'),
			},
		},
	};
	return model;
}

function pipelineFace(faceKey) {
	return {
		faceKey,
		artifacts: {
			sourceSvg: `scripts/output/asset-pipeline/source-svgs/test/${faceKey}.svg`,
		},
		state: {
			parts: {},
			bindings: {},
		},
	};
}
