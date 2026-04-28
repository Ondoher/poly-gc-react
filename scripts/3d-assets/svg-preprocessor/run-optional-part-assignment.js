import {
	OptionalPartAssignmentRunner,
} from './OptionalPartAssignmentRunner.js';
import { readArgument, requireArgument } from './cli-arguments.js';
import { PipelineModel } from './PipelineModel.js';

const DEFAULT_REFERENCE_NAME = 'default-large-faces';

main();

async function main() {
	const tilesetId = requireArgument('--tileset-id');
	const referenceName = readArgument('--reference-name') || DEFAULT_REFERENCE_NAME;
	const legacyPipelineState = readArgument('--pipeline-state');

	if (legacyPipelineState) {
		throw new Error('--pipeline-state is no longer accepted. Optional Part Assignment writes through PipelineModel.');
	}

	const model = new PipelineModel({ referenceName, tileSetName: tilesetId });
	const runner = new OptionalPartAssignmentRunner();

	await model.start();

	const summary = await runner.run({
		tilesetId,
		pipelineModel: model,
		faceKey: readArgument('--face-key') || null,
	});

	console.log(JSON.stringify(summary, null, 2));
}
