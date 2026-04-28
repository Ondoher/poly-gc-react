import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(here, '..', '..');

function forceToPosix(source) {
	let value = String(source || '').trim();

	if (value.startsWith('file:')) {
		try {
			value = fileURLToPath(value);
		} catch {
			// Keep the original text when it is not a parseable file URL.
		}
	}

	value = path.normalize(value).replace(/\\/g, '/');
	if (/^\/[A-Za-z]:\//.test(value)) {
		value = value.slice(1);
	}

	return value;
}

function isAbsolutePath(value) {
	return path.isAbsolute(value) || /^[A-Za-z]:\//.test(value) || value.startsWith('//');
}

export function normalizePath(filePath) {
	const normalized = forceToPosix(filePath);
	const absolutePath = isAbsolutePath(normalized)
		? normalized
		: forceToPosix(path.resolve(ROOT_DIR, normalized));
	const relativePath = forceToPosix(path.relative(ROOT_DIR, absolutePath));

	return relativePath.startsWith('../') || relativePath === '..'
		? absolutePath
		: relativePath;
}

export function resolvePath(filePath) {
	const normalized = forceToPosix(filePath);
	return isAbsolutePath(normalized)
		? normalized
		: path.resolve(ROOT_DIR, normalized);
}
