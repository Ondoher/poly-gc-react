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
			sourceSvg: `scripts/data/asset-pipeline/source-svgs/test/${faceKey}.svg`,
		},
		state: {
			parts: {},
			bindings: {},
		},
	};
}
