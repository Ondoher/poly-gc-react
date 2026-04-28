import {readFile, writeFile} from 'node:fs/promises';

export async function readJsonFile(filename) {
    var content = await readFile(filename, 'utf-8');
	return JSON.parse(content);
}

export async function writeJsonFile(filePath, layout) {
    await writeFile(filePath, JSON.stringify(layout, null, '    '), 'utf-8');
}

export function forceToPosix(src) {
	src = src.replace('file:', '/');
	src = src.replace('///', '/');
	src = src.replace(/.*?:/, '');
	src = src.replace(/\\/g, '/');

	return src;
}
