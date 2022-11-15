#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));

console.log(argv);
var params = argv._;
var thisDir = path.dirname(module.filename) + '/';

// size of the tile image in pixels
var width = argv.width||56;
var height = argv.height||77;

// how much to adjust the x and y values for each z level
var depthx = argv.depthx||8;
var depthy = argv.depthy||7;

// how much of the tile image is not the face but the sides of the tile
var rightPad = argv.rightpad||9;
var bottomPad = argv.bottompad||9;


var faceWidth = width - rightPad;
var faceHeight = height - bottomPad;

// each tile occupies two grid spaces in both x and y
var gridWidth = faceWidth / 2;
var gridHeight = faceHeight / 2;


var gridDepthX = depthx;
var gridDepthY = depthy;
var name;

console.warn(width, height, depthx, depthy, rightPad, bottomPad);
console.warn(faceWidth, faceHeight, gridWidth, gridHeight, gridDepthX, gridDepthY);

function unDos(filepath)
{
	filepath = path.resolve(filepath);
  	filepath = filepath.replace(/\\/g, '/');
	return filepath;
}

thisDir = unDos(thisDir) + '/';

function outputInstructions()
{
	var instructions = fs.readFileSync(thisDir + 'instructions.txt', {encoding:'utf-8'});
	console.log(instructions);
};


// grid goes from right to left, 30 x 20 X 7
// to calculate position, 0, 0, 6 is in the top left,
// stacking: higher z, lower x, higher y


function gridToCss(x, y, z)
{

	var left = x * gridWidth + (gridDepthX * (6 - z));
	var top = y * gridHeight + (gridDepthY * (6 - z));
	var zindex = 0;

	if (Math.floor(x % 2) == 0)	x = x + 1;
	if (Math.floor(y % 2) == 0)	y = y + 1;

	zindex = (((y) * (x)) + ((z) * 20 * 30));

	return {left: left, top: top, zindex: zindex};
}


function outputTile()
{
	console.log('.' +  name + ' .tile {position: absolute; width: ' + width + 'px; height: ' + height + 'px}');
	console.log('.' +  name + ' .highlight:after {content: ""; position: absolute; left:0; right: 0; width: ' + width + 'px; height: ' + height + 'px; background-image: url("/gc/pages/mj/assets/images/tilesets/' + name + '/highlight.png")}');
}

function outputGrid()
{
	for (var x = 0; x < 30; x++)
		for (var y = 0; y < 20; y++)
			for (var z = 0; z < 7; z++)
			{
				var coord = gridToCss(x, y, z);
				console.log('.' +  name + ' .pos-' + x + '-' + y + '-' + z + ' {left: ' + coord.left + 'px; top: ' + coord.top + 'px; z-index: ' + coord.zindex + '}');
			}
}

function outputNFaces(start, n, image)
{
	console.error(start, n, image);
	for (var idx = start, stop = idx + n; idx < stop; idx++)
		console.log('.' +  name + ' .face-' + idx + ' {background-image: url("/gc/pages/mj/assets/images/tilesets/' + name + '/' + image + '")}');
//		console.log('.' +  name + ' .face-' + idx + ' {background-image: url("assets/images/tilesets/' + name + '/' + image + '")}');
	console.error(start, n, image, 'done');

	return start + n;
}

function outputStandardFaces()
{
	var n = 0;
	for (var idx = 1; idx <= 9; idx++) n = outputNFaces(n, 4, 'b' + idx + '.png');
	for (var idx = 1; idx <= 9; idx++) n = outputNFaces(n, 4, 'c' + idx + '.png');
	for (var idx = 1; idx <= 9; idx++) n = outputNFaces(n, 4, 'd' + idx + '.png');
	n = outputNFaces(n, 4, 'dragon-g.png');
	n = outputNFaces(n, 4, 'dragon-r.png');
	n = outputNFaces(n, 4, 'dragon-w.png');
	n = outputNFaces(n, 4, 'wind-n.png');
	n = outputNFaces(n, 4, 'wind-s.png');
	n = outputNFaces(n, 4, 'wind-e.png');
	n = outputNFaces(n, 4, 'wind-w.png');
	n = outputNFaces(n, 1, 'flower-1.png');
	n = outputNFaces(n, 1, 'flower-2.png');
	n = outputNFaces(n, 1, 'flower-3.png');
	n = outputNFaces(n, 1, 'flower-4.png');
	n = outputNFaces(n, 1, 'season-1.png');
	n = outputNFaces(n, 1, 'season-2.png');
	n = outputNFaces(n, 1, 'season-3.png');
	n = outputNFaces(n, 1, 'season-4.png');

	console.error(n);
}


function main()
{
	if (params.length != 1)
	{
		outputInstructions();
		process.exit(1);
	}

	name = params[0];

	if (width === undefined || height === undefined || depthx === undefined || depthy === undefined || rightPad === undefined || bottomPad === undefined)
	{
		outputInstructions();
		process.exit(1);
	}

	outputTile();
	outputGrid()
	outputStandardFaces()


}

main();
