import { SourceAlignmentRunner } from './SourceAlignmentRunner.js';
import { readArgument, requireArgument } from './cli-arguments.js';
import { PipelineModel } from './PipelineModel.js';

const DEFAULT_REFERENCE_NAME = 'default-large-faces';

async function main() {
	const tilesetId = requireArgument('--tileset-id');
	const referenceName = readArgument('--reference-name') || DEFAULT_REFERENCE_NAME;
	const legacyPipelineState = readArgument('--pipeline-state');
	const legacyReferenceStructure = readArgument('--reference-structure');

	if (legacyPipelineState) {
		throw new Error('--pipeline-state is no longer accepted. Source Alignment writes through PipelineModel.');
	}
	if (legacyReferenceStructure) {
		throw new Error('--reference-structure is no longer accepted. Source Alignment reads the model-owned reference.');
	}

	const model = new PipelineModel({ referenceName, tileSetName: tilesetId });
	const runner = new SourceAlignmentRunner();

	await model.start();

	const summary = await runner.run({
		tilesetId,
		faceKey: readArgument('--face-key') || null,
		pipelineModel: model,
		metadataPath: readArgument('--metadata') || process.env.FACE_PREPROCESSING_METADATA || null,
	});

	console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
