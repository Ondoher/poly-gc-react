import path from 'node:path/posix';
import {readFile, writeFile} from 'node:fs/promises';
import parseArgs  from 'minimist';
import { getOptions } from './options.js';
import { forceToPosix } from './utils.js';

var argv = parseArgs(process.argv.slice(2));
var params = argv._;

var defaultOptions = {
	imageSet: false,
}

var flags = {
}
var options = getOptions(defaultOptions, argv, flags);
options.imageSet = argv['image-set'] || argv.retina || argv['2x'] || options.imageSet;

var name = params[0];
var outputFilename = params[1] || `${name}.css`;

var scriptDir = forceToPosix(new URL('.', import.meta.url).pathname);

async function writeCssFile(css) {
	await writeFile(outputFilename, css, 'utf-8');
}

async function renderInstructions()
{
	var filename = path.join(scriptDir, 'ts-instructions.txt');
	var instructions = await readFile(filename, {encoding:'utf-8'});
	console.log(instructions);
};

function renderFaces()
{
	var result = ''
	var n = 0;

	result += `.${name} .face {background-repeat: no-repeat; background-position: 0 0}\n`;

	function renderFaceImage(image) {
		if (!options.imageSet) {
			return `url("../../images/tile-faces/${name}/${image}")`;
		}

		const stem = image.replace(/\.png$/i, '');
		return `image-set(url("../../images/tile-faces/${name}/${stem}.png") 1x, url("../../images/tile-faces/${name}/${stem}@2x.png") 2x)`;
	}

	function renderNFaces(start, n, image)
	{
		for (let idx = start, stop = idx + n; idx < stop; idx++) {
			result += `.${name} .face-${idx} {background-image: ${renderFaceImage(image)}}\n`;
		}

		return start + n;
	}

	for (let idx = 1; idx <= 9; idx++) n = renderNFaces(n, 4, 'b' + idx + '.png');
	for (let idx = 1; idx <= 9; idx++) n = renderNFaces(n, 4, 'c' + idx + '.png');
	for (let idx = 1; idx <= 9; idx++) n = renderNFaces(n, 4, 'd' + idx + '.png');
	n = renderNFaces(n, 4, 'dragon-g.png');
	n = renderNFaces(n, 4, 'dragon-r.png');
	n = renderNFaces(n, 4, 'dragon-w.png');
	n = renderNFaces(n, 4, 'wind-n.png');
	n = renderNFaces(n, 4, 'wind-s.png');
	n = renderNFaces(n, 4, 'wind-e.png');
	n = renderNFaces(n, 4, 'wind-w.png');
	n = renderNFaces(n, 1, 'flower-1.png');
	n = renderNFaces(n, 1, 'flower-2.png');
	n = renderNFaces(n, 1, 'flower-3.png');
	n = renderNFaces(n, 1, 'flower-4.png');
	n = renderNFaces(n, 1, 'season-1.png');
	n = renderNFaces(n, 1, 'season-2.png');
	n = renderNFaces(n, 1, 'season-3.png');
	n = renderNFaces(n, 1, 'season-4.png');

	result += `.${name} .highlight:after {background-color: rgba(244, 148, 126, 0.34)}\n`;

	return result;
}


async function main()
{
	if (params.length == 0 || params.length > 2) {
		renderInstructions();
		process.exit(-1);
	}

	var css = renderFaces();

	await writeCssFile(css);
}

await main();
