
import path from 'node:path/posix';
import {readFile, writeFile} from 'node:fs/promises';
import parseArgs  from 'minimist';
import { getOptions, getOption } from './options.js';
import { forceToPosix, readJsonFile } from './utils.js';
import { GRID_DEPTH, GRID_WIDTH, GRID_HEIGHT } from './table-size.js';
import {
	buildMetrics,
	getCanvasDimensions,
	getSizeDefinition,
	gridToCssPosition,
} from './metrics.js';

var argv = parseArgs(process.argv.slice(2));
var params = argv._;

var flags = {
	width: 'w',
	height: 'h',
	xdepth: 'x',
	ydepth: 'y',
	rpad: 'r',
	bpad: 'b',
	size: 's',
	config: 'c',
}

var size;
var configFilename;
var options;
var width;
var height;
var depthx;
var depthy;
var rightPad;
var bottomPad;
var faceWidth;
var faceHeight;
var gridWidth;
var gridHeight;
var gridDepthX;
var gridDepthY;
var metrics;
var name;
var outputFilename;
var scriptDir = forceToPosix(new URL('.', import.meta.url).pathname);
var scriptCommand = 'node .\\scripts\\tile-css\\tilesize.js';
var defaultConfigFilename = path.join(scriptDir, 'tile-sizes.json');

async function renderInstructions()
{
	var filename = path.join(scriptDir, 'ts-instructions.txt');
	var instructions = await readFile(filename, {encoding:'utf-8'});
	console.log(instructions);
};

async function loadSizeOptions()
{
	size = getOption(argv, 'size', 's') || params[0] || 'normal';
	configFilename = getOption(argv, 'config', 'c') || defaultConfigFilename;

	var sizes = await readJsonFile(configFilename);
	var useOptions = getSizeDefinition(sizes, size);

	if (!useOptions) {
		throw new Error(`No size definition found for "${size}" in ${configFilename}`);
	}

	options = getOptions(useOptions, argv, flags);

	width = options.width;
	height = options.height;
	depthx = options.xdepth;
	depthy = options.ydepth;
	metrics = buildMetrics(options);
	rightPad = metrics.rightPad;
	bottomPad = metrics.bottomPad;
	faceWidth = metrics.faceWidth;
	faceHeight = metrics.faceHeight;
	gridWidth = metrics.cellWidth;
	gridHeight = metrics.cellHeight;
	gridDepthX = metrics.depthX;
	gridDepthY = metrics.depthY;
}

// grid goes from right to left, 30 x 16 X 7
// to calculate position, 0, 0, 6 is in the top left,

function outputComment() {
	return(
`/*******************************************************************************
This file auto generated for tile type: ${name}

Tile shape
==========
width:  ${options.width}
height: ${options.height}
xdepth: ${options.xdepth}
ydepth: ${options.ydepth}
rpad:   ${options.rpad}
bpad:   ${options.bpad}

config:  ${configFilename}

Dimensions
==========
grid:   ${GRID_WIDTH}, ${GRID_HEIGHT}, ${GRID_DEPTH}
canvas: ${canvasWidth}, ${canvasHeight}
face:   ${faceWidth}, ${faceHeight}
cell:   ${gridWidth}, ${gridHeight}
*******************************************************************************/

`)
}

function renderCanvasSize() {
	return (
`/*==============================================================================
The size of the canvas based on the tile dimensions
*/
.${name}.board-canvas {
	width: ${canvasWidth}px;
	height: ${canvasHeight}px;
}

`)
}

function renderPreviewMaxSize() {
	return (
`/*==============================================================================
The preview surface size when this tile size is the maximum available size
*/
.preview-max-${name} {
	width: ${canvasWidth}px;
	height: ${canvasHeight}px;
}

`)
}

async function writeCssFile(css) {
	await writeFile(outputFilename, css, 'utf-8');
}

function gridToCss(x, y, z)
{
	return gridToCssPosition(x, y, z, metrics);
}

var canvasWidth;
var canvasHeight;

function renderDefaults()
{
	return (
`/*==============================================================================
Common css for all tiles
*/
.${name} .tile {
	position: absolute;
	width: ${options.width}px;
	height: ${options.height}px;
	--mj-tile-width: ${options.width}px;
	--mj-tile-height: ${options.height}px;
	--mj-tile-face-width: ${faceWidth}px;
	--mj-tile-face-height: ${faceHeight}px;
	--mj-tile-right-pad: ${rightPad}px;
	--mj-tile-bottom-pad: ${bottomPad}px;
}
.${name} .face {
	position: relative;
	width: ${options.width}px;
	height: ${options.height}px;
}
.${name} .face:after {
	content: "";
	position: absolute;
	left: 0;
	top: 0;
	width: ${faceWidth}px;
	height: ${faceHeight}px;
	background-repeat: no-repeat;
	background-size: 100% 100%;
	opacity: 0;
	pointer-events: none;
}
.${name} .highlight:after {opacity: 1;}
`)
}

function outputGrid()
{
	var result = (

`/*==============================================================================
Defines absolute position for each cell in the grid. Add these classes to a tile
to position it in the correct grid cell.

The correct class to use looks like this: pos-<x>-<y>-<z>
*/
`)

	for (var z = 0; z < 7; z++)
		for (var y = 0; y < GRID_HEIGHT; y++)
			for (var x = 0; x < GRID_WIDTH; x++)
			{
				var coord = gridToCss(x, y, z);

				var style = `.${name} .pos-${x}-${y}-${z} {`;
				style += `left: ${coord.left}px; `;
				style += `top: ${coord.top}px; `;
				style += `z-index: ${coord.zindex};`;
				style += `}`;

				result += style + '\n';
			}
	return result
}

async function main()
{
	if (params.length === 0 || params.length > 2)
	{
		await renderInstructions();
		process.exit(1);
	}

	name = params[0];
	outputFilename = params[1] || `${name}.css`;
	await loadSizeOptions();

	if (width === undefined || height === undefined || depthx === undefined || depthy === undefined || rightPad === undefined || bottomPad === undefined)
	{
		await renderInstructions();
		process.exit(1);
	}

	var canvasSize = getCanvasDimensions(metrics);
	canvasWidth = canvasSize.canvasWidth;
	canvasHeight = canvasSize.canvasHeight;

	var css = outputComment();
	css += renderCanvasSize();
	css += renderPreviewMaxSize();
	css += renderDefaults();
	css += outputGrid();

	await writeCssFile(css);
}

main();
