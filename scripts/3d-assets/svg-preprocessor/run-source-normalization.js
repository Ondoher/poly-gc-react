import {
	SourceNormalizationRunner,
} from './SourceNormalizationRunner.js';
import { readArgument, requireArgument } from './cli-arguments.js';
import { PipelineModel } from './PipelineModel.js';

const DEFAULT_REFERENCE_NAME = 'default-large-faces';

async function main() {
	const tilesetId = requireArgument('--tileset-id');
	const referenceName = readArgument('--reference-name') || DEFAULT_REFERENCE_NAME;
	const legacyPipelineState = readArgument('--pipeline-state');

	if (legacyPipelineState) {
		throw new Error('--pipeline-state is no longer accepted. Source Normalization writes through PipelineModel.');
	}

	const model = new PipelineModel({ referenceName, tileSetName: tilesetId });
	const runner = new SourceNormalizationRunner();

	await model.start();

	const summary = await runner.run({
		pipelineModel: model,
		tilesetId,
		faceKey: readArgument('--face-key') || null,
	});

	console.log(JSON.stringify({
		tilesetId: summary.tilesetId || tilesetId,
		faceCount: summary.faceCount,
		faceKey: summary.faceKey,
		componentCount: summary.componentCount,
		alignmentComponentCount: summary.alignmentComponentCount,
		shapeCount: summary.shapeCount,
		alignmentShapeCount: summary.alignmentShapeCount,
		componentsDir: summary.componentsDir,
		warningCount: summary.warningCount,
	}, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
