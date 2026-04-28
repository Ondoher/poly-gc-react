import { SourceSemanticAssignmentRunner } from './SourceSemanticAssignmentRunner.js';
import { readArgument, requireArgument } from './cli-arguments.js';
import { PipelineModel } from './PipelineModel.js';

const DEFAULT_REFERENCE_NAME = 'default-large-faces';

async function main() {
	const tilesetId = requireArgument('--tileset-id');
	const referenceName = readArgument('--reference-name') || DEFAULT_REFERENCE_NAME;
	const legacyPipelineState = readArgument('--pipeline-state');
	const legacyReferenceStructure = readArgument('--reference-structure');

	if (legacyPipelineState) {
		throw new Error('--pipeline-state is no longer accepted. Source Semantic Assignment writes through PipelineModel.');
	}
	if (legacyReferenceStructure) {
		throw new Error('--reference-structure is no longer accepted. Source Semantic Assignment reads the model-owned reference.');
	}

	const model = new PipelineModel({ referenceName, tileSetName: tilesetId });
	const runner = new SourceSemanticAssignmentRunner();

	await model.start();

	const summary = await runner.run({
		tilesetId,
		faceKey: readArgument('--face-key') || null,
		pipelineModel: model,
	});

	console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
