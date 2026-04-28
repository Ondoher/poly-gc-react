import { FinalRenderingCompositionRunner } from './FinalRenderingCompositionRunner.js';
import { readArgument, requireArgument } from './cli-arguments.js';

async function main() {
	const runner = new FinalRenderingCompositionRunner();
	const pipelineStatePath = readArgument('--pipeline-state');
	if (pipelineStatePath) {
		throw new Error('--pipeline-state is no longer accepted. Final Rendering reads the model-owned pipeline state.');
	}

	const summary = await runner.run({
		tilesetId: requireArgument('--tileset-id'),
		faceKey: readArgument('--face-key') || null,
	});

	console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
