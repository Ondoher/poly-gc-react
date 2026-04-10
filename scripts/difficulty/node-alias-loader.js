import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

export async function resolve(specifier, context, nextResolve) {
	if (specifier.startsWith('utils/')) {
		return nextResolve(
			pathToFileURL(path.join(REPO_ROOT, 'src/gc', specifier)).href,
			context
		);
	}

	return nextResolve(specifier, context);
}
